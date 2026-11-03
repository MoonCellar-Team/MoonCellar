"use client";

import { FC } from "react";
import { ICustomList } from "@mooncellar/schemas";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { ListCard } from "@/src/lib/shared/ui/ListCard";
import { ListCardsGrid } from "@/src/lib/shared/ui/ListCardsGrid";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import styles from "./CollectionsPage.module.scss";

interface ICollectionsPageProps {
  collections: ICustomList[];
}

export const CollectionsPage: FC<ICollectionsPageProps> = ({ collections }) => (
  <>
    <BGImage />
    <div className={styles.page}>
      <Box contentStyle={{ gap: "var(--gap-x4)" }}>
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Collections", href: "/collections" },
          ]}
        />
        <SectionTitle as="h1" variant="display">
          Collections
        </SectionTitle>
        <p className={styles.page__intro}>
          MoonCellar&apos;s own rankings of the catalogue, rebuilt every week
          from the combined rating of IGDB, HowLongToBeat and MoonCellar
          players.
        </p>
      </Box>

      <Box contentStyle={{ gap: "var(--gap-x5)" }}>
        {collections.length ? (
          <ListCardsGrid>
            {collections.map((collection) => (
              <ListCard
                key={collection._id}
                list={collection}
                isWithAuthor={false}
              />
            ))}
          </ListCardsGrid>
        ) : (
          <EmptyState
            title="No collections yet"
            description="They appear here after the next weekly rebuild."
          />
        )}
      </Box>
    </div>
  </>
);
