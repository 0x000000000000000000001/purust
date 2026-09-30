module Purust.DecoderSchemas (specializeDecoderSchemas) where

import Prelude hiding (apply, one)
import Control.Alternative (guard)
import Control.Monad.State (get, put, runState)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Foldable (all, foldl, foldMap)
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Newtype (unwrap)
import Data.Set as Set
import Data.String as String
import Data.String.Pattern (Pattern(..), Replacement(..))
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import Purust.Utf16 (rustStrLiteral)
import PureScript.Backend.Optimizer.Convert (BackendModule)
import PureScript.Backend.Optimizer.CoreFn (Ident(..), Literal(..), Module(..), ModuleName(..), Prop(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn as CF
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendOperatorOrd(..), BackendSyntax(..), Level(..), Pair(..))

-- A success-path program, proved from the actual dictionary and method body.
-- Failure ALWAYS replays the original composition, preserving error priority,
-- custom recovery and parser messages. No opaque callback runs speculatively.
data Schema = Scalar String | Sequence Schema | Optional Schema
  | ObjectSchema (Array (Tuple String Schema)) | Derived (Maybe CF.ExprType) Program
data Program = ReadField Level String Boolean Boolean Schema Program
  | Choice Level String Program Program | ReturnValue NeutralExpr | Reject
data Atom = Input | ObjectInput | ReadValue Schema Level | Value NeutralExpr
  | Success Atom | BooleanValue Boolean | Test Level String
  | Closure (Map.Map Level Atom) (Array (Tuple (Maybe Ident) Level)) NeutralExpr
  | Constructor NeutralExpr Int (Array Atom)
type Context =
  { owner :: ModuleName
  , definitions :: Map.Map Ident NeutralExpr
  , constructors :: Map.Map (Qualified Ident) Int
  , constructorResults :: Map.Map (Qualified Ident) CF.ExprType
  }

strip :: NeutralExpr -> BackendSyntax NeutralExpr
strip (NeutralExpr syn) = case syn of
  Typed _ inner -> strip inner
  TypeApp inner _ -> strip inner
  _ -> syn

global :: String -> String -> NeutralExpr -> Boolean
global owner name expr = case strip expr of
  Var (Qualified (Just (ModuleName m)) (Ident n)) -> m == owner && n == name
  _ -> false

standard :: String -> NeutralExpr -> Boolean
standard = global "Data.Argonaut.Decode.Class"

either :: String -> Qualified Ident -> Boolean
either name = (_ == Qualified (Just (ModuleName "Data.Either")) (Ident name))

resolve :: Context -> Int -> NeutralExpr -> Maybe (Tuple NeutralExpr (Array NeutralExpr))
resolve ctx fuel expr
  | fuel <= 0 = Nothing
  | otherwise = case strip expr of
      Var (Qualified (Just owner) name) | owner == ctx.owner -> case Map.lookup name ctx.definitions of
        Just body -> resolve ctx (fuel - 1) body
        Nothing -> Just (Tuple expr [])
      App fn args -> do
        Tuple head prior <- resolve ctx (fuel - 1) fn
        pure (Tuple head (prior <> NEA.toArray args))
      _ -> Just (Tuple expr [])

one :: forall a. Array a -> Maybe a
one [ a ] = Just a
one _ = Nothing

erased :: NeutralExpr -> Boolean
erased expr = case strip expr of
  PrimUndefined -> true
  _ -> false

string :: NeutralExpr -> Maybe String
string expr = case strip expr of
  Lit (LitString value) -> Just value
  _ -> Nothing

symbol :: Context -> Int -> NeutralExpr -> Maybe String
symbol ctx fuel expr = do
  Tuple head args <- resolve ctx fuel expr
  guard (Array.null args)
  case strip head of
    Lit (LitRecord [ Prop "reflectSymbol" method ]) -> case strip method of
      Abs refs body | NEA.length refs == 1 -> string body
      _ -> Nothing
    _ -> Nothing

decoder :: Context -> Int -> NeutralExpr -> Maybe Schema
decoder ctx fuel expr = do
  Tuple head args <- resolve ctx fuel expr
  let recur = decoder ctx (fuel - 1)
  case args of
    [] | standard "decodeJsonInt" head -> pure (Scalar "Int")
    [] | standard "decodeJsonNumber" head -> pure (Scalar "Number")
    [] | standard "decodeJsonString" head -> pure (Scalar "String")
    [] | standard "decodeJsonBoolean" head -> pure (Scalar "Boolean")
    [] | standard "decodeJsonJson" head -> pure (Scalar "Json")
    [ inner ] | standard "decodeArray" head -> Sequence <$> recur inner
    [ inner ] | standard "decodeJsonMaybe" head -> Optional <$> recur inner
    [ row, proxy ] | standard "decodeRecord" head && erased proxy -> ObjectSchema <$> record ctx (fuel - 1) row
    [] -> case strip head of
      Lit (LitRecord [ Prop "decodeJson" method ]) -> do
        guard (fuel > 0)
        program <- evaluate ctx (fuel - 1) Map.empty 0 method \next fn ->
          apply ctx (fuel - 1) next fn [ Input ] \_ result -> case result of
            Success value -> ReturnValue <$> expression value
            _ -> Nothing
        pure (Derived (join (programResult ctx program)) program)
      _ -> Nothing
    _ -> Nothing

record :: Context -> Int -> NeutralExpr -> Maybe (Array (Tuple String Schema))
record ctx fuel expr = do
  Tuple head args <- resolve ctx fuel expr
  case args of
    [] | standard "gDecodeJsonNil" head -> pure []
    [ field, native, tail, label, cons, lacks ] | standard "gDecodeJsonCons" head && erased cons && erased lacks -> do
      key <- symbol ctx (fuel - 1) label
      Tuple fieldHead fieldArgs <- resolve ctx (fuel - 1) field
      schema <- case fieldArgs of
        [ inner ] | standard "decodeFieldId" fieldHead -> do
          child <- decoder ctx (fuel - 1) inner
          -- A deliberately supplied DecodeJsonField identity dictionary for
          -- Maybe requires a present key. Only decodeFieldMaybe permits absence.
          guard (case child of
            Optional _ -> false
            _ -> true)
          pure child
        [ inner ] | standard "decodeFieldMaybe" fieldHead -> Optional <$> decoder ctx (fuel - 1) inner
        _ -> Nothing
      guard (nativeMatches ctx (fuel - 1) schema native)
      rest <- record ctx (fuel - 1) tail
      guard (not (Array.any (\(Tuple name _) -> name == key) rest))
      pure (Array.cons (Tuple key schema) rest)
    _ -> Nothing

-- NativeField is a second dictionary in this port, and may not be ignored.
-- Only the standard matching construction plans justify eliminating it.
nativeMatches :: Context -> Int -> Schema -> NeutralExpr -> Boolean
nativeMatches ctx fuel schema expr = fromMaybe false do
  Tuple head args <- resolve ctx fuel expr
  pure case schema, args of
    Scalar tag, [] -> standard ("nativeField" <> tag) head
    Derived _ _, [] -> standard "nativeFieldOther" head
    Optional inner, [ arg ] -> standard "nativeFieldMaybe" head && nativeMatches ctx (fuel - 1) inner arg
    Sequence inner, [ arg ] -> standard "nativeFieldArray" head && nativeMatches ctx (fuel - 1) inner arg
    ObjectSchema fields, [ proxy, row ] -> standard "nativeFieldRecord" head && erased proxy
      && fromMaybe false (map (sameFields fields) (record ctx (fuel - 1) row))
    _, _ -> false

sameFields :: Array (Tuple String Schema) -> Array (Tuple String Schema) -> Boolean
sameFields a b = Array.length a == Array.length b && all identity
  (Array.zipWith (\(Tuple ka va) (Tuple kb vb) -> ka == kb && sameSchema va vb) a b)

sameSchema :: Schema -> Schema -> Boolean
sameSchema (Scalar a) (Scalar b) = a == b
sameSchema (Optional a) (Optional b) = sameSchema a b
sameSchema (Sequence a) (Sequence b) = sameSchema a b
sameSchema (ObjectSchema a) (ObjectSchema b) = sameFields a b
-- The ordinary DecodeJson dictionary, not NativeFieldOther, owns this body.
sameSchema (Derived _ _) (Derived _ _) = false
sameSchema _ _ = false

-- PBO may expose a standard method rather than its dictionary. Tags alone are
-- insufficient: verify the actual method supplied to an identity FFI marker.
methodSchema :: Context -> Int -> NeutralExpr -> Maybe Schema
methodSchema ctx fuel expr = do
  Tuple head args <- resolve ctx fuel expr
  case strip head, args of
    Accessor dictionary (GetProp "decodeJson"), [] -> decoder ctx (fuel - 1) dictionary
    _, [ dictionary ] | standard "decodeJson" head -> decoder ctx (fuel - 1) dictionary
    _, [ support, method ] | standard "recordErrorSupport" support -> do
      tag <- Array.find (\tag -> global "Data.Argonaut.Decode.Internal.Record" ("typed" <> tag) head)
        [ "Int", "Number", "String", "Boolean" ]
      guard (primitiveMethod tag method)
      pure (Scalar tag)
    _, [ child ] | global "Data.Argonaut.Decode.Internal.Record" "nativeMaybe" head -> Optional <$> methodSchema ctx (fuel - 1) child
    _, [ fallback, child ] | global "Data.Argonaut.Decode.Internal.Record" "nativeArray" head -> do
      -- The fallback is a known, pure construction, not an arbitrary call.
      Tuple base params <- resolve ctx (fuel - 1) fallback
      guard (global "Data.Argonaut.Decode.Decoders" "decodeArray" base && Array.length params == 1)
      original <- one params >>= methodSchema ctx (fuel - 1)
      schema <- methodSchema ctx (fuel - 1) child
      guard (sameSchema original schema)
      pure (Sequence schema)
    _, _ -> Nothing

primitiveMethod :: String -> NeutralExpr -> Boolean
primitiveMethod tag expr
  | global "Data.Argonaut.Decode.Decoders" ("decode" <> tag) expr = true
  | otherwise = case strip expr of
      App fn args | global "Data.Argonaut.Core" ("caseJson" <> tag) fn -> case NEA.toArray args of
        [ fallback, right ] -> passive fallback && global "Data.Either" "Right" right
        _ -> false
      _ -> false

passive :: NeutralExpr -> Boolean
passive expr = case strip expr of
  Lit (LitString _) -> true
  Lit (LitInt _) -> true
  Lit (LitNumber _) -> true
  Lit (LitBoolean _) -> true
  CtorSaturated _ _ _ _ fields -> all (\(Tuple _ value) -> passive value) fields
  _ -> false

expression :: Atom -> Maybe NeutralExpr
expression = case _ of
  Value expr -> Just expr
  BooleanValue flag -> Just (NeutralExpr (Lit (LitBoolean flag)))
  ReadValue schema level -> Just (NeutralExpr (Typed (schemaType schema) (NeutralExpr (Local Nothing level))))
  _ -> Nothing

reader :: NeutralExpr -> Maybe (Tuple Boolean Boolean)
reader fn
  | global "Data.Argonaut.Decode.Decoders" "getField" fn = Just (Tuple false false)
  | global "Data.Argonaut.Decode.Decoders" "getFieldOptional" fn = Just (Tuple true false)
  | global "Data.Argonaut.Decode.Decoders" "getFieldOptional'" fn = Just (Tuple true true)
  | otherwise = Nothing

objectMethod :: Context -> Int -> NeutralExpr -> Boolean
objectMethod ctx fuel expr = fromMaybe false do
  dictionary <- case strip expr of
    Accessor dictionary (GetProp "decodeJson") -> Just dictionary
    App fn args | standard "decodeJson" fn -> one (NEA.toArray args)
    _ -> Nothing
  Tuple head args <- resolve ctx fuel dictionary
  pure (standard "decodeForeignObject" head && case args of
    [ inner ] -> standard "decodeJsonJson" inner
    _ -> false)

-- Bounded symbolic evaluation handles lexical scopes directly, including the
-- immediately applied branches left by bind/apply. It is local to recognition;
-- unsuccessful recognition leaves the original PBO expression untouched.
evaluate :: Context -> Int -> Map.Map Level Atom -> Int -> NeutralExpr -> (Int -> Atom -> Maybe Program) -> Maybe Program
evaluate ctx fuel env next original k
  | fuel <= 0 = Nothing
  | otherwise = case strip original of
      Local _ level -> Map.lookup level env >>= k next
      Abs refs body -> k next (Closure env (NEA.toArray refs) body)
      Let _ level value body -> go value \n atom -> evaluate ctx (fuel - 1) (Map.insert level atom env) n body k
      Lit (LitString _) -> k next (Value original)
      Lit (LitInt _) -> k next (Value original)
      Lit (LitNumber _) -> k next (Value original)
      Lit (LitBoolean flag) -> k next (BooleanValue flag)
      Var ctor -> case Map.lookup ctor ctx.constructors of
        Just arity -> k next (Constructor original arity [])
        Nothing -> Nothing
      CtorSaturated ctor _ _ _ _ | either "Left" ctor -> Just Reject
      CtorSaturated ctor _ _ _ [ Tuple _ value ] | either "Right" ctor -> go value (\n atom -> k n (Success atom))
      CtorSaturated ctor ct tn cn fields | Map.member ctor ctx.constructors ->
        values (map (\(Tuple _ value) -> value) fields) \n atoms -> do
          exprs <- traverse expression atoms
          k n (Value (NeutralExpr (CtorSaturated ctor ct tn cn (Array.zipWith (\(Tuple key _) value -> Tuple key value) fields exprs))))
      Accessor value (GetCtorField ctor _ _ _ "value0" 0) | either "Right" ctor -> go value \n atom -> case atom of
        Success payload -> k n payload
        _ -> Nothing
      PrimOp (Op1 (OpIsTag ctor) value) | either "Left" ctor || either "Right" ctor -> go value \n atom -> case atom of
        Success _ -> k n (BooleanValue (either "Right" ctor))
        _ -> Nothing
      PrimOp (Op2 (OpStringOrd OpEq) a b) -> values [ a, b ] \n atoms -> case atoms of
        [ ReadValue (Scalar "String") level, Value literal ] -> string literal >>= k n <<< Test level
        [ Value literal, ReadValue (Scalar "String") level ] -> string literal >>= k n <<< Test level
        _ -> Nothing
      Branch cases other -> branch (NEA.toArray cases) other
      App fn args -> case reader fn, NEA.toArray args of
        Just (Tuple optional nullable), [ method, object, label ] -> do
          schema <- methodSchema ctx (fuel - 1) method
          key <- string label
          go object \n atom -> case atom of
            ObjectInput -> do
              let level = Level n
              rest <- k (n + 1) (Success (ReadValue (if optional then Optional schema else schema) level))
              pure (ReadField level key optional nullable schema rest)
            _ -> Nothing
        _, [ json ] | objectMethod ctx fuel fn -> go json \n atom -> case atom of
          Input -> k n (Success ObjectInput)
          _ -> Nothing
        _, _ -> go fn \n function -> evalValues ctx (fuel - 1) env n (NEA.toArray args) \n' atoms -> apply ctx (fuel - 1) n' function atoms k
      _ -> Nothing
  where
  go = evaluate ctx (fuel - 1) env next
  values = evalValues ctx (fuel - 1) env next
  branch cases other = case Array.uncons cases of
    Nothing -> go other k
    Just { head: Pair condition body, tail } -> go condition \n atom -> case atom of
      BooleanValue true -> evaluate ctx (fuel - 1) env n body k
      BooleanValue false -> branch tail other
      Test level literal -> Choice level literal <$> evaluate ctx (fuel - 1) env n body k <*> branch tail other
      _ -> Nothing

evalValues :: Context -> Int -> Map.Map Level Atom -> Int -> Array NeutralExpr -> (Int -> Array Atom -> Maybe Program) -> Maybe Program
evalValues ctx fuel env next args k = case Array.uncons args of
  Nothing -> k next []
  Just { head, tail } -> evaluate ctx fuel env next head \n atom ->
    evalValues ctx fuel env n tail (\n' rest -> k n' (Array.cons atom rest))

apply :: Context -> Int -> Int -> Atom -> Array Atom -> (Int -> Atom -> Maybe Program) -> Maybe Program
apply ctx fuel next fn args k
  | fuel <= 0 = Nothing
  | Array.null args = k next fn
  | otherwise = case fn of
      Closure env refs body -> case Array.uncons refs, Array.uncons args of
        Just { head: Tuple _ level, tail: remaining }, Just { head: arg, tail } ->
          let env' = Map.insert level arg env
          in if Array.null remaining then evaluate ctx (fuel - 1) env' next body (\n result -> apply ctx (fuel - 1) n result tail k)
             else apply ctx (fuel - 1) next (Closure env' remaining body) tail k
        _, _ -> Nothing
      Constructor ctor arity prior -> do
        let allArgs = prior <> args
        guard (Array.length allArgs <= arity)
        if Array.length allArgs < arity then k next (Constructor ctor arity allArgs)
        else do
          exprs <- traverse expression allArgs >>= NEA.fromArray
          k next (Value (NeutralExpr (App ctor exprs)))
      _ -> Nothing

-- Layout information is derived only after the method body has been proved.
-- Keep the existing ADT ABI (including its Rc) while removing the outer
-- per-element Value::Class allocation in homogeneous result arrays.
programResult :: Context -> Program -> Maybe (Maybe CF.ExprType)
programResult ctx = case _ of
  ReadField _ _ _ _ _ next -> programResult ctx next
  Choice _ _ yes no -> do
    a <- programResult ctx yes
    b <- programResult ctx no
    case a, b of
      Nothing, _ -> pure b
      _, Nothing -> pure a
      Just ta, Just tb | ta == tb -> pure a
      _, _ -> Nothing
  Reject -> Just Nothing
  ReturnValue value -> Just <$> result value
  where
  result value = case strip value of
    CtorSaturated ctor _ _ _ _ -> Map.lookup ctor ctx.constructorResults
    App fn _ -> case strip fn of
      Var ctor -> Map.lookup ctor ctx.constructorResults
      _ -> Nothing
    _ -> Nothing

weight :: Schema -> Int
weight = case _ of
  Scalar _ -> 1
  Sequence child -> 1 + weight child
  Optional child -> 1 + weight child
  ObjectSchema fields -> 1 + foldl (\n (Tuple _ child) -> n + weight child) 0 fields
  Derived _ program -> programWeight program
  where
  programWeight = case _ of
    ReadField _ _ _ _ child rest -> 1 + weight child + programWeight rest
    Choice _ _ a b -> 1 + programWeight a + programWeight b
    _ -> 1

textComplete :: Schema -> Boolean
textComplete = case _ of
  Scalar "Json" -> false
  Sequence child -> textComplete child
  Optional child -> textComplete child
  ObjectSchema fields -> all (\(Tuple _ child) -> textComplete child) fields
  Derived _ program -> complete program
  _ -> true
  where
  complete = case _ of
    ReadField _ _ _ _ child next -> textComplete child && complete next
    Choice _ _ a b -> complete a && complete b
    _ -> true

parameters :: NeutralExpr -> Array (Tuple Level CF.ExprType)
parameters = Map.toUnfoldable <<< collect
  where
  collect (NeutralExpr syn) = case syn of
    Typed ty inner -> case strip inner of
      Local _ level -> Map.singleton level ty
      _ -> collect inner
    Local _ level -> Map.singleton level CF.Any
    _ -> foldl (\acc child -> Map.union acc (collect child)) Map.empty syn

schemaType :: Schema -> CF.ExprType
schemaType = case _ of
  Scalar "Int" -> CF.Int
  Scalar "Number" -> CF.Number
  Scalar "Boolean" -> CF.Boolean
  Scalar "String" -> CF.String
  _ -> CF.Any

moveArgument :: CF.ExprType -> String -> String
moveArgument ty value = case ty of
  CF.Int -> unboxField (Scalar "Int") value
  CF.Number -> unboxField (Scalar "Number") value
  CF.Boolean -> unboxField (Scalar "Boolean") value
  CF.String -> unboxField (Scalar "String") value
  _ -> value

resultType :: CF.ExprType
resultType = CF.ADT "Either" [ "Data", "Either", "Either" ] []

domType :: CF.ExprType
domType = CF.Func [ CF.Any ] resultType

textType :: CF.ExprType
textType = CF.Func [ CF.String ] resultType

runtime :: String
runtime = "Purs_Data_Argonaut_Decode_Internal_Record::"

-- Native functions use Option<Value> internally, one public Either at the
-- root. Rust monomorphizes the same worker for DOM and text cursors.
emit :: Boolean -> Boolean -> (CF.ExprType -> String) -> String -> Schema -> String
emit layouts arrays representation name schema =
  (case schema of
    ObjectSchema fields | layouts ->
      function name "purust_core::Value" (name <> "_value(raw).map(|value| purust_core::Value::NativeRecord(std::rc::Rc::new(value)))")
      <> function (name <> "_value") (name <> "_Record") (body (ObjectSchema fields))
    Derived (Just ty) program | arrays ->
      function name "purust_core::Value" (name <> "_value(raw).map(|value| purust_core::Value::Class(std::rc::Rc::new(value)))")
      <> function (name <> "_value") (representation ty) (slots (keys program) <> programCode (keys program) name program)
    _ -> function name "purust_core::Value" (body schema))
    <> (case schema of
      ObjectSchema fields | layouts -> recordLayout name fields
      _ -> "")
    <> foldMap (\(Tuple child value) -> emit layouts arrays representation child value) (children name schema)
  where
  function label ty code = "fn " <> label <> "<I: " <> runtime <> "SchemaInput>(raw: I) -> Option<" <> ty <> "> {\n" <> code <> "\n}\n"
  success value = "Some(" <> value <> ")"
  body = case _ of
    Scalar tag -> "raw.scalar(" <> quote tag <> ")"
    Optional _ -> "if raw.is_null() { " <> success (runtime <> "purust_maybe_nothing()") <> " } else { Some(" <> runtime <> "purust_maybe_just(" <> name <> "_item(raw)?)) }"
    Sequence child ->
      let packed = case child of
            ObjectSchema _ | layouts && arrays -> Just (Tuple "NativeRecords" (name <> "_item_value(item)?"))
            Derived (Just _) _ | arrays -> Just (Tuple "NativeClasses" (name <> "_item_value(item)?"))
            Scalar "Int" | arrays -> Just (Tuple "IntArray" (unboxField child (name <> "_item(item)?")))
            _ | arrays && isScalar child -> Just (Tuple "NativeScalars" (unboxField child (name <> "_item(item)?")))
            _ -> Nothing
          Tuple container item = fromMaybe (Tuple "Array" (name <> "_item(item)?")) packed
          wrap = if container == "Array" || container == "IntArray"
            then "purust_core::Value::" <> container <> "(std::rc::Rc::new(out))"
            else "purust_core::Value::NativeArray(std::rc::Rc::new(purust_core::" <> container <> "(out)))"
      in "let items = raw.array()?;\nlet mut out = Vec::with_capacity(items.len());\nfor item in items { out.push(" <> item <> "); }\nSome(" <> wrap <> ")"
    ObjectSchema fields ->
      slots (map (\(Tuple key _) -> key) fields)
      <> String.joinWith "\n" (Array.mapWithIndex (\i (Tuple _ child) ->
        "let value" <> show i <> " = match input" <> show i <> " { Some(raw) => " <> name <> "_field" <> show i <> "(raw)?, None => "
          <> (case child of
              Optional _ -> runtime <> "purust_maybe_nothing()"
              _ -> "return None") <> " };" ) fields)
      <> (if layouts then
        "\nSome(" <> name <> "_Record {"
        <> String.joinWith "," (Array.mapWithIndex (\i (Tuple _ child) -> "field" <> show i <> ": " <> unboxField child ("value" <> show i)) fields)
        <> "})"
      else "\nstd::thread_local! { static KEYS: [std::rc::Rc<str>; " <> show (Array.length fields) <> "] = ["
      <> String.joinWith "," (map (\(Tuple key _) -> "std::rc::Rc::from(" <> quote key <> ")") fields) <> "]; }\n"
      <> "KEYS.with(|keys| { let mut fields = purust_core::RecordFields::with_capacity(" <> show (Array.length fields) <> ");\n"
      <> String.joinWith "\n" (Array.mapWithIndex (\i _ -> "fields.push(keys[" <> show i <> "].clone(), value" <> show i <> ");") fields)
      <> "\nSome(purust_core::Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields))) })")
    Derived _ program -> slots (keys program) <> programCode (keys program) name program

isScalar :: Schema -> Boolean
isScalar schema = case fieldScalar schema of
  Just _ -> true
  Nothing -> false

-- Complete concrete fields, exposed through the same record projection API.
-- Arrays, optionals and custom ADTs already hold their ordinary eager result;
-- projections of those values borrow the original carrier without rebuilding.
fieldScalar :: Schema -> Maybe (Tuple String String)
fieldScalar = case _ of
  Scalar "Int" -> Just (Tuple "i64" "Int")
  Scalar "Number" -> Just (Tuple "f64" "Number")
  Scalar "Boolean" -> Just (Tuple "bool" "Bool")
  Scalar "String" -> Just (Tuple "String" "String")
  _ -> Nothing

unboxField :: Schema -> String -> String
unboxField schema value = case fieldScalar schema of
  Just (Tuple _ variant) -> "match " <> value <> " { purust_core::Value::" <> variant <> "(value) => value, _ => return None }"
  Nothing -> value

recordLayout :: String -> Array (Tuple String Schema) -> String
recordLayout name fields =
  "struct " <> name <> "_Record {\n"
  <> foldMap identity (Array.mapWithIndex (\i (Tuple _ schema) -> "field" <> show i <> ": "
    <> (case fieldScalar schema of
      Just (Tuple ty _) -> ty
      Nothing -> "purust_core::Value") <> ",\n") fields)
  <> "}\nimpl purust_core::NativeRecord for " <> name <> "_Record {\n"
  <> "fn keys(&self) -> &'static [&'static str] { &[" <> String.joinWith "," (map (\(Tuple key _) -> quote key) fields) <> "] }\n"
  <> "fn get(&self, name: &str) -> Option<std::borrow::Cow<'_, purust_core::Value>> { match name {\n"
  <> foldMap identity (Array.mapWithIndex (\i (Tuple key schema) -> quote key <> " => Some("
    <> (case fieldScalar schema of
      Just (Tuple _ variant) -> "std::borrow::Cow::Owned(purust_core::Value::" <> variant <> "(self.field" <> show i
        <> (if variant == "String" then ".clone()" else "") <> "))"
      Nothing -> "std::borrow::Cow::Borrowed(&self.field" <> show i <> ")") <> "),\n") fields)
  <> "_ => None } }\n}\n"

quote :: String -> String
quote = rustStrLiteral

slots :: Array String -> String
slots names = "let [" <> String.joinWith "," (Array.mapWithIndex (\i _ -> "mut input" <> show i) names)
  <> "] = raw.fields([" <> String.joinWith "," (map quote names) <> "])?;\n"

keys :: Program -> Array String
keys = Array.nub <<< go
  where
  go = case _ of
    ReadField _ key _ _ _ next -> Array.cons key (go next)
    Choice _ _ a b -> go a <> go b
    _ -> []

local :: Level -> String
local (Level n) = "field" <> show n

programCode :: Array String -> String -> Program -> String
programCode names name = case _ of
  ReadField level key optional nullable _ next ->
    "let " <> local level <> " = match input" <> show (fromMaybe 0 (Array.elemIndex key names))
    <> (if Array.elem key (keys next) then ".clone()" else ".take()") <> " {\n"
    <> (if optional then "None => " <> runtime <> "purust_maybe_nothing(),\n" else "None => return None,\n")
    <> (if nullable then "Some(raw) if raw.is_null() => " <> runtime <> "purust_maybe_nothing(),\n" else "")
    <> "Some(raw) => " <> (if optional then runtime <> "purust_maybe_just(" else "") <> name <> "_read(raw)?"
    <> (if optional then ")" else "") <> "\n};\n" <> programCode names (name <> "_next") next
  Choice level literal yes no -> "if matches!(&" <> local level <> ", purust_core::Value::String(value) if value == " <> quote literal <> ") {\n"
    <> programCode names (name <> "_yes") yes <> "\n} else {\n" <> programCode names (name <> "_no") no <> "\n}"
  ReturnValue value -> "Some(" <> name <> "_construct(" <> String.joinWith "," (map (\(Tuple level ty) -> moveArgument ty (local level)) (parameters value)) <> "))"
  Reject -> "None"

children :: String -> Schema -> Array (Tuple String Schema)
children name = case _ of
  Sequence inner -> [ Tuple (name <> "_item") inner ]
  Optional inner -> [ Tuple (name <> "_item") inner ]
  ObjectSchema fields -> Array.mapWithIndex (\i (Tuple _ child) -> Tuple (name <> "_field" <> show i) child) fields
  Derived _ program -> reads name program
  _ -> []
  where
  reads path = case _ of
    ReadField _ _ _ _ schema next -> Array.cons (Tuple (path <> "_read") schema) (reads (path <> "_next") next)
    Choice _ _ a b -> reads (path <> "_yes") a <> reads (path <> "_no") b
    _ -> []

constructors :: Boolean -> String -> Schema -> Array (Tuple Ident NeutralExpr)
constructors arrays name = case _ of
  Derived native program -> sources (if arrays then fromMaybe CF.Any native else CF.Any) name program
  schema -> Array.concatMap (\(Tuple child value) -> constructors arrays child value) (children name schema)
  where
  sources result path = case _ of
    ReadField _ _ _ _ schema next -> constructors arrays (path <> "_read") schema <> sources result (path <> "_next") next
    Choice _ _ a b -> sources result (path <> "_yes") a <> sources result (path <> "_no") b
    ReturnValue value ->
      let params = parameters value
          refs = map (\(Tuple level _) -> Tuple Nothing level) params
          expr = NeutralExpr (Typed result value)
          body = case NEA.fromArray refs of
            Nothing -> expr
            Just bindings -> NeutralExpr (Typed (CF.Func (map (\(Tuple _ ty) -> ty) params) result) (NeutralExpr (Abs bindings expr)))
      in [ Tuple (Ident (path <> "_construct")) body ]
    _ -> []

specializeDecoderSchemas :: Boolean -> Boolean -> (CF.ExprType -> String) -> (String -> String) -> Map.Map String CF.ExprType -> Module CF.Ann -> BackendModule
  -> { module :: BackendModule, arities :: Map.Map String CF.ExprType, code :: String }
specializeDecoderSchemas layouts arrays representation sanitize arities (Module core) mod
  | not (Map.member "Data_Argonaut_Decode_Internal_Record_schemaDecoderABI2" arities) = { module: mod, arities, code: "" }
  | otherwise =
      let
        ctx = { owner: mod.name
          , definitions: Map.fromFoldable (Array.concatMap (\g -> if g.recursive then [] else g.bindings) mod.bindings)
          , constructors: Map.fromFoldable (Array.concatMap (\decl -> map (\ctor -> Tuple
              (Qualified (Just mod.name) (Ident ctor.name)) (Array.length ctor.fields)) decl.constructors) core.dataDecls)
          , constructorResults: Map.fromFoldable (Array.concatMap (\decl -> map (\ctor -> Tuple
              (Qualified (Just mod.name) (Ident ctor.name)) (CF.ADT decl.name
                (Array.snoc (String.split (Pattern ".") (unwrap mod.name)) decl.name) [])) decl.constructors) core.dataDecls)
          }
        initial = { next: 0, code: "", sources: [], arities }
        Tuple bindings result = runState (traverse (rewriteGroup ctx) mod.bindings) initial
      in { module: mod { bindings = bindings <> [ { recursive: false, bindings: result.sources } ] }, arities: result.arities, code: result.code }
  where
  prefix = String.replaceAll (Pattern ".") (Replacement "_") (unwrap mod.name) <> "_"
  names = Set.fromFoldable (map (\(Tuple (Ident name) _) -> sanitize name) (Array.concatMap _.bindings mod.bindings))
  candidate ctx expr = case strip expr of
    App fn args | standard "decodeJson" fn -> do
      dictionary <- one (NEA.toArray args)
      schema <- decoder ctx 128 dictionary
      guard (weight schema > 1 && weight schema <= 256)
      pure (Tuple false schema)
    App fn args | global "Data.Argonaut.Decode.Parser" "decodeJsonStringWith" fn
      && Map.member "Data_Argonaut_Decode_Internal_Record_schemaTextDecoderABI2" arities -> do
      method <- one (NEA.toArray args)
      schema <- methodSchema ctx 128 method
      guard (weight schema > 1 && weight schema <= 256 && textComplete schema)
      pure (Tuple true schema)
    _ -> Nothing
  rewriteGroup ctx group
    | group.recursive = pure group
    | otherwise = do
        bindings <- traverse (\(Tuple ident expr) -> Tuple ident <$> rewrite ctx expr) group.bindings
        pure group { bindings = bindings }
  rewrite ctx expr@(NeutralExpr syn) = case candidate ctx expr of
    Just (Tuple text schema) -> allocate text schema expr
    Nothing -> case syn of
      LetRec _ _ _ -> pure expr
      _ -> NeutralExpr <$> traverse (rewrite ctx) syn
  allocate text schema original = do
    state <- get
    let name = "__purust_json_" <> show state.next
        full = prefix <> name
        source = name <> "_source"
        ty = if text then textType else domType
        next = state { next = state.next + 1 }
    if Array.any (\existing -> String.contains (Pattern name) existing) (Set.toUnfoldable names)
      || Array.any (String.contains (Pattern full)) (Array.fromFoldable (Map.keys arities)) then put next *> allocate text schema original
    else do
      let worker = name <> "_worker"
          qualifiedWorker = prefix <> worker
          sourceBindings = [ Tuple (Ident source) (NeutralExpr (Typed ty original)) ] <> constructors arrays worker schema
          workerCode = emit layouts arrays representation qualifiedWorker schema
          input = if text then "String" else "purust_core::Value"
          cursor = if text then runtime <> "SchemaText::parse(&input).map(|doc| " <> qualifiedWorker <> "(doc.root())) .flatten()"
            else qualifiedWorker <> "(" <> runtime <> "SchemaDom(input.clone()))"
          code = "pub fn " <> full <> "(input: " <> input <> ") -> std::rc::Rc<Purs_Data_Either::Either> {\n"
            <> "match " <> cursor <> " { Some(value) => std::rc::Rc::new(Purs_Data_Either::Either::Right(value)), None => " <> prefix <> source <> "(input) }\n}\n"
      put next { code = state.code <> workerCode <> code
        , sources = state.sources <> sourceBindings
        , arities = Map.insert full ty state.arities }
      pure (NeutralExpr (Typed ty (NeutralExpr (Var (Qualified (Just mod.name) (Ident name))))))
