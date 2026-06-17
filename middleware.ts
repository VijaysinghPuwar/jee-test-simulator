import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/signin" },
});

export const config = {
  matcher: ["/exam/:path*", "/results/:path*", "/settings/:path*"],
};
