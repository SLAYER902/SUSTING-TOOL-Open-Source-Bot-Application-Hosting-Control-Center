import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const user = await currentUser(); if (!user) redirect("/login");
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: { deployments: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { variables: true } } } });
  return <DashboardClient initialProjects={JSON.parse(JSON.stringify(projects))} user={{ username: user.username, role: user.role }} />;
}
