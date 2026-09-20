import registry from "@/data/registry.json";
import type { RegistryEntry } from "./types";

export const entries = registry as RegistryEntry[];
export const getEntry = (id: string) => entries.find((entry) => entry.id === id);
