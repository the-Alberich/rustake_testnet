// scripts/types/yargs.d.ts

declare module "yargs" {
  const yargs: any;
  export = yargs;
}

declare module "yargs/helpers" {
  const helpers: any;
  export = helpers;

  export function hideBin(argv: string[]): string[];
}
