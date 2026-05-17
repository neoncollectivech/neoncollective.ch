import { heroui } from "@heroui/theme";

const colors = {
  focus: "#FF3131",
  primary: {
    DEFAULT: "#FF3131",
  },
  success: {
    DEFAULT: "#FF3131",
  },
  warning: {
    DEFAULT: "#F9C80E",
  },
  danger: {
    DEFAULT: "#FD1D53",
  },
};

export default heroui({
  addCommonColors: false,
  defaultTheme: "dark",
  themes: {
    dark: {
      colors: { ...colors, background: "#050505" },
    },
  },
});
