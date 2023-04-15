import { NextApiRequest, NextApiResponse } from "next";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { authenticateUser } from "@/utils/supabase";

type OctokitMethod = keyof RestEndpointMethodTypes;

interface OctokitCall {
  octokitMethod: OctokitMethod;
  args: Record<string, unknown>;
}

function isOctokitCategory(
  octokit: Octokit,
  category: string
): category is keyof Octokit["rest"] {
  return category in octokit.rest;
}

function isOctokitMethod(
  octokit: Octokit,
  category: keyof Octokit["rest"],
  method: string
): method is keyof Octokit["rest"][typeof category] {
  return method in octokit.rest[category];
}

async function callOctokitMethod(octokit: Octokit, octokitCall: OctokitCall) {
  const { octokitMethod, args } = octokitCall;
  const methodParts = octokitMethod.split(".");

  if (methodParts.length !== 2) {
    throw new Error("Invalid octokitMethod");
  }

  const [category, method] = methodParts;

  if (
    !isOctokitCategory(octokit, category) ||
    !isOctokitMethod(octokit, category, method)
  ) {
    throw new Error("Invalid octokitMethod");
  }

  return (octokit.rest[category][method] as any)(args);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { octokitMethod, args } = req.query;

  const authHeader = req.headers.authorization;
  console.log("authHeader", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  const isAnonymous = token === "ANONYMOUS";

  try {
    const parsedArgs = JSON.parse(args as string);
    const octokit = isAnonymous ? new Octokit() : new Octokit({ auth: token });

    // Logging the requested function call and constructed call
    console.log("Requested function call:", octokitMethod);
    console.log("Constructed call with args:", parsedArgs);

    const data = await callOctokitMethod(octokit, {
      octokitMethod: octokitMethod as OctokitMethod,
      args: parsedArgs,
    });

    res.status(200).json(data);
  } catch (error: any) {
    console.error("Error while calling the Octokit method:", error);

    if (error.status === 404) {
      res.status(404).json({ error: "Not Found" });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}
