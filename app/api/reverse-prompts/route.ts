import { readMissionProfile } from "@/lib/openclaw";
import { readProjects } from "@/lib/project-store";
import { readTeamMembers } from "@/lib/openclaw";
import { ReversePromptTemplate } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [mission, projects, team] = await Promise.all([
    readMissionProfile(),
    readProjects(),
    readTeamMembers(),
  ]);

  const primaryProjects = projects.slice(0, 5).map((project) => project.name).join(", ");
  const teamSummary = team.map((member) => `${member.id}:${member.role}`).join(", ");

  const templates: ReversePromptTemplate[] = [
    {
      id: "tool-discovery",
      title: "Tool Discovery",
      description: "Identify missing tools based on current workflows.",
      prompt: `Based on our current mission control usage and history, suggest 5 custom tools we should add next. Prioritize leverage and repeatability. Mission: "${mission.statement}".`,
    },
    {
      id: "mission-alignment",
      title: "Mission Alignment Check",
      description: "Generate next actions aligned with mission statement.",
      prompt: `Given this mission statement: "${mission.statement}", propose the top 3 tasks we should execute this week and explain why each directly improves mission progress.`,
    },
    {
      id: "project-progress",
      title: "Project Progress Tasking",
      description: "Produce actionable tasks for active projects.",
      prompt: `For these projects: ${primaryProjects || "no named projects yet"}, propose one high-leverage next task per project and assign each to the best-fit agent from this team: ${teamSummary || "main:Orchestrator"}.`,
    },
    {
      id: "workflow-gap",
      title: "Workflow Gap Analysis",
      description: "Find bottlenecks and propose improvements.",
      prompt: "Analyze our recent task activity and identify where we are losing time. Recommend concrete automation or workflow changes to remove those bottlenecks.",
    },
  ];

  return NextResponse.json({ templates });
}

