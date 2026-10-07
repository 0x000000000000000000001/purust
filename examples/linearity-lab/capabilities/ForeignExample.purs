module LinearLab.Capabilities.ForeignExample
  ( Attachment, attach, appendByte, sizeAndClose ) where

import Prelude (Unit)
import LinearLab.Capabilities.Sub as S

-- Added entirely in this third-party module. The core library knows neither
-- this type nor its operations; no Clone instance is granted.
foreign import data Attachment :: Type
foreign import attach :: S.Sub Int Attachment
foreign import appendByte :: S.Sub Attachment Attachment
foreign import sizeAndClose :: S.Sub Attachment Int
foreign import discardAttachment :: S.Sub Attachment Unit

instance dropAttachment :: S.Drop Attachment where
  drop = discardAttachment
