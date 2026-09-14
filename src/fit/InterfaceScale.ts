import { createContext, useContext } from "react";

/** React context also reaches help dialogs rendered outside the zoomed app DOM. */
export const InterfaceScaleContext = createContext(1);
export const useInterfaceScale = () => useContext(InterfaceScaleContext);
