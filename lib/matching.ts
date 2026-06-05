import { connectToDatabase } from "./mongodb";
import { ObjectId } from "mongodb";

export interface WalletInfo {
  address: string;
  privateKey: string;
  path: string;
}

export interface MatchedVendorResult {
  vendorId: string;
  adId: string;
  exchangeRate: number;
  paymentMethodId: string;
  paymentMethodType: string;
  accountHolderName: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  qrCodeUrl?: string;
  upiId?: string;
  terms?: string;
  vendorWallet: WalletInfo;
}

export async function findBestVendorForOrder(
  amountINR: number,
  selectedMethod: string // PhonePe, GPay, Paytm, UPI, IMPS
): Promise<MatchedVendorResult | null> {
  try {
    const { db } = await connectToDatabase();
    
    // Fetch all currently locked adIds (where status is 'pending' or 'confirming' AND has not expired yet, OR status is 'withheld')
    const activePayments = await db.collection("payments")
      .find({
        $or: [
          { status: { $in: ["pending", "confirming"] }, expiresAt: { $gt: Date.now() } },
          { status: "withheld" }
        ],
        adId: { $exists: true, $ne: null }
      })
      .toArray();

    const lockedAdIds = new Set(activePayments.map((p: any) => p.adId));
    console.log(`[MatchingEngine] Found ${lockedAdIds.size} locked ads currently in progress.`);

    // Query active sell advertisements
    const advertisements = await db.collection("advertisements")
      .find({
        status: "Active",
        listingStatus: "Visible",
        direction: "Sell",
        fiatCurrency: "INR",
        assetToken: "USDT"
      })
      .toArray();

    const eligibleVendors: MatchedVendorResult[] = [];

    for (const ad of advertisements) {
      // 1. Check if ad is locked by another user
      if (lockedAdIds.has(ad.adId)) {
        console.log(`[MatchingEngine] Skipping ad ${ad.adId}: currently locked by a pending transaction.`);
        continue;
      }

      // 2. Check Limits
      const minLimit = Number(ad.minLimit);
      const maxLimit = Number(ad.maxLimit);

      if (amountINR < minLimit || amountINR > maxLimit) {
        continue;
      }

      // 2. Resolve Payment Methods
      if (!ad.paymentMethods || !Array.isArray(ad.paymentMethods)) continue;

      // Convert ObjectIds safely
      const pmIds = ad.paymentMethods
        .filter((id: any) => typeof id === "string" ? ObjectId.isValid(id) : ObjectId.isValid(id))
        .map((id: any) => new ObjectId(id));
      
      const paymentMethods = await db.collection("paymentmethods")
        .find({
          _id: { $in: pmIds },
          status: "Active"
        })
        .toArray();

      for (const pm of paymentMethods) {
        let isMatch = false;

        const selUpper = selectedMethod.toUpperCase().replace(/\s+/g, "");
        const pmUpper = pm.type ? pm.type.toUpperCase().replace(/\s+/g, "") : "";

        // 1. Direct exact match (e.g., "PHONEPE" === "PHONEPE")
        if (selUpper === pmUpper) {
          isMatch = true;
        }
        // 2. Specific brand selections can match generic UPI or corresponding brand
        else if (["PHONEPE", "GPAY", "GOOGLEPAY", "PAYTM"].includes(selUpper)) {
          if (pmUpper === "UPI") {
            isMatch = true;
          } else if (selUpper === "GOOGLEPAY" && pmUpper === "GPAY") {
            isMatch = true;
          } else if (selUpper === "GPAY" && pmUpper === "GOOGLEPAY") {
            isMatch = true;
          }
        }
        // 3. Generic UPI selection can match any specific UPI brand
        else if (selUpper === "UPI") {
          if (["UPI", "PHONEPE", "GPAY", "GOOGLEPAY", "PAYTM"].includes(pmUpper)) {
            isMatch = true;
          }
        }
        // 4. Bank transfer selections match transfer types or checking account numbers
        else if (["IMPS", "BANKTRANSFER"].includes(selUpper)) {
          if (["BANKTRANSFER", "IMPS"].includes(pmUpper) || pm.accountNumber) {
            isMatch = true;
          }
        }
        // 5. Broad generic fallbacks
        else if (pmUpper === "UPI" || pmUpper === "BANKTRANSFER") {
          isMatch = true;
        }

        if (isMatch) {
          // Look up user profile in vendorprofiles
          let profileName = pm.accountHolderName;
          if (!profileName && pm.userId) {
            try {
              const userIdObj = typeof pm.userId === "string" ? new ObjectId(pm.userId) : pm.userId;
              const userProfile = await db.collection("vendorprofiles").findOne({ _id: userIdObj as any });
              if (userProfile) {
                profileName = userProfile.name || userProfile.companyName || userProfile.companyBrandName;
              } else if (typeof pm.userId === "string") {
                // Fallback to query by string _id
                const userProfileStr = await db.collection("vendorprofiles").findOne({ _id: pm.userId as any });
                if (userProfileStr) {
                  profileName = userProfileStr.name || userProfileStr.companyName || userProfileStr.companyBrandName;
                }
              }
            } catch (e) {
              // Silent lookup failure
            }
          }

          // Derive deterministic TRON wallet for this vendor
          const vendorIdStr = ad.vendorId.toString();
          const cleanId = vendorIdStr.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
          const vendorWallet = {
            address: `TStubVendorAddress_${cleanId || "Default"}`,
            privateKey: "stub_vendor_private_key_mock",
            path: `m/44'/195'/0'/0/mock`
          };

          eligibleVendors.push({
            vendorId: vendorIdStr,
            adId: ad.adId,
            exchangeRate: Number(ad.fixedPrice),
            paymentMethodId: pm._id.toString(),
            paymentMethodType: pm.type,
            accountHolderName: profileName || "Not Available",
            accountNumber: pm.accountNumber || undefined,
            ifscCode: pm.ifscCode || undefined,
            bankName: pm.bankName || undefined,
            qrCodeUrl: pm.qrCodeUrl || undefined,
            upiId: pm.upiId || undefined,
            terms: ad.terms || undefined,
            vendorWallet,
          });
        }
      }
    }

    if (eligibleVendors.length === 0) {
      return null;
    }

    // 3. Sort by Best Exchange Rate (lowest price per USDT is best for buyer)
    eligibleVendors.sort((a, b) => a.exchangeRate - b.exchangeRate);

    const bestMatch = eligibleVendors[0];
    return bestMatch;
  } catch (err) {
    console.error("[MatchingEngine] Error matching best vendor:", err);
    return null;
  }
}
