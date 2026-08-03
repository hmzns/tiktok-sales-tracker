import type { Request, Response } from "express";
import {
  completeTikTokShopAuthorization,
  createTikTokShopAuthorization,
  getTikTokConnectionStatus,
  refreshTikTokShopToken,
  syncAuthorizedTikTokShop,
  TikTokCallbackError,
} from "../services/tiktokShop.service";
import {
  getTikTokSyncHistory,
  syncTikTokOrdersWithHistory,
  TikTokSyncSource,
} from "../services/tiktokSync.service";

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
  const code =
    getSingleQueryValue(req.query.code) ??
    getSingleQueryValue(req.query.auth_code);
  const tiktokError = getSingleQueryValue(req.query.error);

  console.warn(
    "tiktok_callback_query_keys",
    Object.keys(req.query).sort()
  );

  try {
    await completeTikTokShopAuthorization({ state, code, tiktokError });
    return redirectOrRespond(
      res,
      process.env.TIKTOK_SHOP_SUCCESS_REDIRECT_URL,
      true
    );
  } catch (error) {
    const category =
      error instanceof TikTokCallbackError
        ? error.category
        : "tiktok_callback_storage_failed";
    console.error(category);

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

export const syncShop = async (req: Request, res: Response) => {
  const shop = await syncAuthorizedTikTokShop();

  return res.json({
    success: true,
    ...shop,
  });
};

export const syncOrders = async (req: Request, res: Response) => {
  const summary = await syncTikTokOrdersWithHistory(
    req.body.days,
    TikTokSyncSource.MANUAL
  );

  return res.json({
    success: true,
    data: summary,
  });
};

export const getSyncHistory = async (req: Request, res: Response) => {
  const history = await getTikTokSyncHistory(
    res.locals.validatedQuery.limit
  );

  return res.json({
    success: true,
    data: history,
  });
};
