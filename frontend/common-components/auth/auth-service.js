import { SignJWT, jwtVerify } from "jose";
import Cookies from "js-cookie";

const SECRET_KEY = new TextEncoder().encode(import.meta.env.VITE_JWT_SECRET);

export const loginAdmin = async (username, password) => {
   if (
      username === import.meta.env.VITE_ADMIN_USER &&
      password === import.meta.env.VITE_ADMIN_PASS
   ) {
      const token = await new SignJWT({ role: "admin" })
         .setProtectedHeader({ alg: "HS256" })
         .setExpirationTime("2h")
         .sign(SECRET_KEY);

      Cookies.set("app_token", token, { expires: 1 / 12 });
      return true;
   }
   return false;
};

export const checkIsAdmin = async () => {
   const token = Cookies.get("app_token");
   if (!token) return false;

   try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      return payload.role === "admin";
   } catch {
      return false;
   }
};
