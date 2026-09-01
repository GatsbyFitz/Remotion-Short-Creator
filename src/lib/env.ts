/**
 * Reads an environment variable at runtime.
 *
 * Next inlines literal `process.env.FOO` references when it builds, which bakes
 * whatever was set during `next build` into the output — so a variable set on
 * the server or in a container would silently have no effect. Going through a
 * dynamic key keeps the lookup where it belongs, at runtime.
 */
export const readEnv = (name: string): string | undefined => {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
};
