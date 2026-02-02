import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins/magic-link"
import { organization } from "better-auth/plugins/organization"
import { Resend } from "resend"
import { prisma } from "./db"

const resend = new Resend(process.env.RESEND_API_KEY!)

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false, // We use magic link only
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/webmasters.readonly'],
    },
  },
  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        try {
          await resend.emails.send({
            from: "SEO Tracker <noreply@yourdomain.com>",
            to: email,
            subject: "Sign in to SEO Tracker",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Sign in to SEO Tracker</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">SEO Tracker</h1>
                    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your SEO Dashboard</p>
                  </div>
                  
                  <h2 style="color: #333; margin-bottom: 20px;">Sign in to your account</h2>
                  
                  <p>Click the button below to sign in to your SEO Tracker dashboard:</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; 
                              padding: 15px 30px; 
                              text-decoration: none; 
                              border-radius: 8px; 
                              font-weight: bold; 
                              display: inline-block;
                              font-size: 16px;">
                      Sign In to SEO Tracker
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    This link will expire in 15 minutes. If you didn't request this email, please ignore it.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
                    <p style="color: #888; font-size: 12px; margin: 0;">
                      SEO Tracker Dashboard | Powered by mahope.dk
                    </p>
                  </div>
                </body>
              </html>
            `,
          });
        } catch (error) {
          console.error('Failed to send magic link email:', error);
          throw error;
        }
      },
    }),
    organization({
      allowUserToCreateOrganization: false, // Only admins can create orgs
      organizationLimit: 1, // Most users belong to one org
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CUSTOMER",
        required: false,
      },
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
})