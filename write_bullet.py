import os
base = r"c:\Users\prana\OneDrive\Desktop\Code\IloveEmployement\components\BulletPointFixerPage.tsx"

lines = [
'"use client";',
'import { useState } from "react";',
'import Link from "next/link";',
'import type {',
'  AiRequestConfig,',
'  BulletFixRequestBody,',
'  BulletFixResult,',
'} from "@/lib/types";',
'import { ProviderConfig } from "./ProviderConfig";',
'import { LoadingState } from "./LoadingState";',
'import { BulletFixResultView } from "./sections/BulletFixResult";',
'',
'type Phase = "idle" | "loading" | "results";',
'',
'const LOADING_MESSAGES = [',
'  "Reading your bullet...",',
'  "Diagnosing the issues...",',
'  "Crafting a better version...",',
'  "Checking the facts...",',
'  "Almost done...",",',
'];',
'']

with open(base, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"Part 1 written")