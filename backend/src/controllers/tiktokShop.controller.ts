import type { Request, Response } from "express";
import {
  completeTikTokShopAuthorization,
  createTikTokShopAuthorization,
  getTikTokConnectionStatus,
  refreshTikTokShopToken,
} from "../services/tiktokShop.service";

export const connect = async (req: Request, res: Response) => {
  const authorization = await createTikTokShopAuthorization();

  return res.json({
    success: true,
    ...authorization,
  });
};

const getSingleQueryValue = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const redirectOrRespond = (
  res: Response,
  destination: string | undefined,
  succeeded: boolean
) => {
  if (destination) {
    try {
      const redirectUrl = new URL(destination);
      if (redirectUrl.protocol === "https:") {
        return res.redirect(303, redirectUrl.toString());
      }
    } catch {
      // Fall back to the safe text response below.
    }
  }

  return res.status(succeeded ? 200 : 400).type("text").send(
    succeeded
      ? "TikTok Shop authorization completed. You may close this window."
      : "TikTok Shop authorization could not be completed. Please return to the application and try again."
  );
};

export const callback = async (req: Request, res: Response) => {
  const state = getSingleQueryValue(req.query.state);
  const code = getSingleQueryValue(req.query.code);
  const tiktokError = getSingleQueryValue(req.query.error);

  try {
    await completeTikTokShopAuthorization({ state, code, tiktokError });
    return redirectOrRespond(
      res,
      process.env.TIKTOK_SHOP_SUCCESS_REDIRECT_URL,
      true
    );
  } catch {
    return redirectOrRespond(
      res,
      process.env.TIKTOK_SHOP_FAILURE_REDIRECT_URL,
      false
    );
  }
};

export const getStatus = async (req: Request, res: Response) => {
  const status = await getTikTokConnectionStatus();

  return res.json({
    success: true,
    ...status,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const connection = await refreshTikTokShopToken();

  return res.json({
    success: true,
    ...connection,
  });
};
