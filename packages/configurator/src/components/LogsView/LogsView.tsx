import React, { useRef, useLayoutEffect, useState } from "react";
import { Wrapper, LogsList, OpenSwitch, Scroll } from "./LogsView.styles";

const LogsView: React.FC = ({ children }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  // Scroll to the bottom any time the component is updated
  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scroll({
        top: listRef.current.scrollHeight,
      });
    }
  });

  // Create an event listener on the listRef on component mount
  // to scroll to the bottom while the component is growing and shrinking
  useLayoutEffect(() => {
    if (listRef.current) {
      const listElement = listRef.current;
      let scrollingInterval: number | undefined;

      const handleStart = (): void => {
        scrollingInterval = setInterval(() =>
          listElement.scroll({
            top: listElement.scrollHeight,
          })
        );
      };

      const handleEnd = (): void => clearInterval(scrollingInterval);
      listElement.addEventListener("transitionstart", handleStart);
      listElement.addEventListener("transitionend", handleEnd);
      return () => {
        listElement.removeEventListener("transitionstart", handleStart);
        listElement.removeEventListener("transitionend", handleEnd);
        clearInterval(scrollingInterval);
      };
    }
    return undefined;
  }, []);

  return (
    <Wrapper>
      <OpenSwitch onClick={() => setOpen(!open)}>
        {open ? "Hide log" : "Show log"}
      </OpenSwitch>
      <Scroll open={open} />
      <LogsList open={open} ref={listRef}>
        {children}
      </LogsList>
    </Wrapper>
  );
};

export default LogsView;
