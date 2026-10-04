import { copyFileSync, constants, existsSync } from "node:fs";
if (!existsSync(".env.local")) {
  copyFileSync(".env.example", ".env.local", constants.COPYFILE_EXCL);
  console.log(
    "Created .env.local with empty credentials. Add your OpenAI key locally, then restart npm run dev.",
  );
} else {
  console.log(".env.local already exists; no settings were overwritten.");
}
console.log(
  "Setup guide: docs/backend-setup.md. No API request or cloud provisioning was performed.",
);
