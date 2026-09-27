import { accessSync, constants, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export class UsageError extends Error {}

export function parseOptions(args, { modules = true, env = process.env } = {}) {
  const options = { targets: [], clean: false, list: false, all: false, keep: false, update: false, resume: null, help: false };
  if (!modules) {
    const update = env.UPDATE_SNAPSHOTS ?? "0";
    if (update !== "0" && update !== "1") throw new UsageError("UPDATE_SNAPSHOTS must be 0 or 1.");
    options.update = update === "1";
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") { options.targets.push(...args.slice(i + 1)); break; }
    if (arg === "-c" || arg === "--clean") options.clean = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (!modules && arg === "--update-snapshots") options.update = true;
    else if (!modules && arg === "--keep-workspace") options.keep = true;
    else if (arg === "--skip-before") {
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new UsageError("--skip-before needs a name.");
      options.resume = value;
    } else if (arg.startsWith("--skip-before=") || arg.startsWith("skip_before=")) {
      options.resume = arg.slice(arg.indexOf("=") + 1);
      if (!options.resume) throw new UsageError("--skip-before needs a name.");
    } else if (arg.startsWith("-")) throw new UsageError(`Unknown option: ${arg}`);
    else options.targets.push(arg);
  }
  if (options.all && options.targets.length) throw new UsageError("Use --all or explicit names, not both.");
  return options;
}

function resumeFrom(items, options, matches) {
  if (!options.resume) return items;
  const index = items.findIndex(item => matches(item, options.resume));
  if (index < 0) throw new UsageError(`Resume target not found in selection: ${options.resume}`);
  return items.slice(index);
}

function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

export function selectModules(root, options) {
  const parent = dirname(root);
  const available = readdirSync(parent).filter(name => {
    if (!name.startsWith("purust-")) return false;
    const script = join(parent, name, "bin/test");
    if (!isFile(script)) return false;
    try { accessSync(script, constants.X_OK); return true; } catch { return false; }
  }).sort();
  const normalize = name => name.startsWith("purust-") ? name : "purust-" + name;
  const candidates = options.targets.length ? options.targets.map(target => {
    const name = normalize(target);
    if (!available.includes(name)) throw new UsageError(`No executable module test: ${target}`);
    return name;
  }) : available;
  const selected = resumeFrom([...new Set(candidates)], options, (name, target) => name === normalize(target));
  if (!selected.length) throw new UsageError("No module tests selected.");
  return selected.map(name => join(parent, name));
}
