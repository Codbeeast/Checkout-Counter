import mongoose, { Schema, Document } from 'mongoose';

export const PAYMENT_METHOD_TYPES = [
    'UPI', 
    'GPay', 
    'PhonePe', 
    'Paytm', 
    'Amazon Pay', 
    'WhatsApp Pay',
    'BHIM',
    'Bank Transfer', 
    'IMPS', 
    'NEFT', 
    'RTGS'
] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_METHOD_STATUSES = ['Active', 'Deactivate', 'Deleted'] as const;
export type PaymentMethodStatus = (typeof PAYMENT_METHOD_STATUSES)[number];

export interface IPaymentMethod extends Document {
    userId: mongoose.Types.ObjectId;
    type: PaymentMethodType;
    title: string;
    
    // Core Details
    upiId?: string; // For UPI types
    accountHolderName?: string;
    accountNumber?: string; // For Bank types
    ifscCode?: string; // For Bank types
    bankName?: string; // For Bank types
    
    // QR Code
    qrCodeUrl?: string;
    
    details?: string; // General / Legacy details
    status: PaymentMethodStatus;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentMethodSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'VendorProfile',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: PAYMENT_METHOD_TYPES,
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        upiId: {
            type: String,
            trim: true,
        },
        accountHolderName: {
            type: String,
            trim: true,
        },
        accountNumber: {
            type: String,
            trim: true,
        },
        ifscCode: {
            type: String,
            trim: true,
        },
        bankName: {
            type: String,
            trim: true,
        },
        qrCodeUrl: {
            type: String,
            trim: true,
        },
        details: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: PAYMENT_METHOD_STATUSES,
            default: 'Active',
            required: true,
        },
    },
    { 
        timestamps: true 
    }
);

// Index for quickly loading active payment methods for a specific user
PaymentMethodSchema.index({ userId: 1, status: 1 });

export default mongoose.models.PaymentMethod || mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);
