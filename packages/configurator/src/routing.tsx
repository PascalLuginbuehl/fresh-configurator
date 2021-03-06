/* eslint-disable import/prefer-default-export */
import React from "react";
import { isElement } from "react-is";
import { useSelectedTabQuery } from "./gql/queries/Configurator.graphql";

type TabElement = React.ReactElement<{ id: string }>;

/**
 * The Tab router is a component which will display any given child
 * element, with the id equal to the selected tab in the graphql state
 */
export const TabRouter: React.FC<{ children: TabElement | TabElement[] }> = ({
  children,
}) => {
  const { data } = useSelectedTabQuery();
  const selectedTab = data?.configurator.tab || undefined;

  const visibleTab =
    selectedTab &&
    React.Children.map(children, (c) => c)
      ?.filter(isElement)
      .filter((c): c is TabElement => typeof c.props.id === "string")
      .find((t) => t.props.id === selectedTab);

  return visibleTab || null;
};
