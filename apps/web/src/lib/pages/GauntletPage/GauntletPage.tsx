"use client";

import { FC, Suspense } from "react";
import styles from "./GauntletPage.module.scss";
import { ConsolesList } from "@/src/lib/widgets/main";
import { WheelContainer } from "@/src/lib/widgets/wheel";
import { ExpandMenu } from "@/src/lib/shared/ui/ExpandMenu";
import { useStatesStore } from "@/src/lib/shared/store/states.store";
import { Filters } from "@/src/lib/features/filters/ui/Filters";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { useWheelStore } from "@/src/lib/shared/store/wheel.store";
import { GauntletModePanel } from "@/src/lib/widgets/gauntlet/GauntletModePanel";
import { GauntletPageSkeleton } from "./GauntletPageSkeleton";

export const GauntletPage: FC = () => {
  const winner = useWheelStore((state) => state.winner);
  const isRoyal = useStatesStore((state) => state.isRoyal);

  return (
    <div className={styles.wrapper}>
      <Suspense fallback={<GauntletPageSkeleton />}>
        <GauntletModePanel />
        <div className={styles.page}>
          {!isRoyal && (
            <ExpandMenu titleOpen="Filters" position="left">
              <Filters isGauntlet />
            </ExpandMenu>
          )}
          <ExpandMenu titleOpen="Lists" position="right">
            <ConsolesList />
          </ExpandMenu>
          <BGImage game={winner} />
          <WheelContainer />
        </div>
      </Suspense>
    </div>
  );
};
