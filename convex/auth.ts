import { v } from "convex/values";
import { query } from "./_generated/server";
import { authComponent } from "./betterAuth/auth";

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      emailVerified: v.boolean(),
      image: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      updatedAt: v.number(),
      userId: v.optional(v.union(v.string(), v.null())),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx);
  },
});
