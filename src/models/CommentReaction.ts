import mongoose, { Schema, Document } from 'mongoose';

export type ReactionType = 'like' | 'dislike';

export interface ICommentReaction extends Document {
  commentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: ReactionType;
  createdAt?: Date;
  updatedAt?: Date;
}

const CommentReactionSchema = new Schema<ICommentReaction>(
  {
    commentId: { type: Schema.Types.ObjectId, ref: 'Comment', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
  },
  { timestamps: true }
);

// Один користувач — одна реакція на коментар
CommentReactionSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export default mongoose.models.CommentReaction || mongoose.model<ICommentReaction>('CommentReaction', CommentReactionSchema);