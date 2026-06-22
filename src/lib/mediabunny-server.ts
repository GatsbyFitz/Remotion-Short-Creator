import { registerMediabunnyServer } from "@mediabunny/server";

let registered = false;

export const ensureMediabunnyServer = () => {
  if (registered) {
    return;
  }

  registerMediabunnyServer();
  registered = true;
};