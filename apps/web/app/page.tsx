import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function IndexPage() { redirect((await currentUser()) ? "/dashboard" : "/login"); }
