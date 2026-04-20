import { useMemo } from "react";
import {
  buildAgentDirectory,
  buildDashboardMetrics,
  buildLiveAgentRows,
  buildLiveAlaSummaries,
} from "@/lib/dashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

export function useDashboardModel() {
  const company = useSquadStore((state) => state.company);
  const squads = useSquadStore((state) => state.squads);
  const activeStates = useSquadStore((state) => state.activeStates);
  const delegations = useSquadStore((state) => state.delegations);
  const handoffs = useSquadStore((state) => state.handoffs);
  const activityLog = useSquadStore((state) => state.activityLog);
  const recentActivity = useSquadStore((state) => state.recentActivity);

  return useMemo(() => {
    const directory = buildAgentDirectory(company);
    const agents = buildLiveAgentRows({
      directory,
      activeStates,
      delegations,
      handoffs,
      recentActivity,
    });
    const metrics = buildDashboardMetrics({
      agents,
      delegations,
      handoffs,
      activeStates,
    });
    const liveAlas = buildLiveAlaSummaries({
      squads,
      activeStates,
      activityLog,
      directory,
    });

    return {
      company,
      directory,
      agents,
      metrics,
      liveAlas,
      activeStates,
      delegations,
      handoffs,
      squads,
      activityLog,
      recentActivity,
    };
  }, [
    company,
    squads,
    activeStates,
    delegations,
    handoffs,
    activityLog,
    recentActivity,
  ]);
}
