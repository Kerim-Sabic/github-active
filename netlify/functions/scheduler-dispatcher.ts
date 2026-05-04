import { dispatchDueSchedules } from "../../src/server/automation/dispatcher";

export default async function handler(): Promise<Response> {
  const result = await dispatchDueSchedules(new Date());
  return Response.json(result);
}

export const config: { schedule: string } = {
  schedule: "*/10 * * * *"
};
