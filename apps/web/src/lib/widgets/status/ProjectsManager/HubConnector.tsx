import { FC } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import styles from "./ProjectsManager.module.scss";

export const HUB_CONNECTOR_PATH = "/hub-connector.zip";

export const HubConnector: FC = () => (
  <Box
    title="Hub connector"
    isTitleStart
    titleAction={
      <Button
        color={ButtonColor.ACCENT}
        href={HUB_CONNECTOR_PATH}
        download
        prefetch={false}
      >
        Download
      </Button>
    }
  >
    <div className={styles.connector}>
      <p className={styles.hint}>
        Connects any repository to the hub from Claude Code. Unpack{" "}
        <code className={styles.code}>hub-connector.zip</code> at the root of
        the repository and run <code className={styles.code}>/hub-init</code>:
        it creates the project here or joins an existing one, connects the
        machine and adds <code className={styles.code}>/hub</code> and{" "}
        <code className={styles.code}>/task</code> with a note on the plan in{" "}
        <code className={styles.code}>CLAUDE.md</code>.
      </p>
      <p className={styles.hint}>
        Needs Node.js 18 or newer, or Bun. Teammates get the commands with the
        repository and run <code className={styles.code}>/hub</code> once for a
        token of their own. To update, unpack a fresh archive over the old one.
      </p>
    </div>
  </Box>
);
