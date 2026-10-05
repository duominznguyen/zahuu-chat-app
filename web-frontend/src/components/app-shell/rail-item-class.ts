export const railItemClass = (active: boolean) =>
  `flex size-11 items-center justify-center rounded-2xl transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  }`;
