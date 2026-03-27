"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Database, Cpu } from "lucide-react";

interface ModeToggleProps {
  mode: "real" | "simulated";
  onModeChange: (mode: "real" | "simulated") => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center space-x-4 rounded-2xl border border-haze bg-mist/80 p-3">
      <div className={`flex items-center space-x-2 transition-colors ${mode === "real" ? "text-primary" : "text-muted-foreground"}`}>
        <Database className="h-4 w-4" />
        <Label htmlFor="mode-toggle" className="text-sm font-medium cursor-pointer">
          Real System
        </Label>
      </div>

      <Switch
        id="mode-toggle"
        checked={mode === "simulated"}
        onCheckedChange={(checked) => onModeChange(checked ? "simulated" : "real")}
        className="data-[state=checked]:bg-secondary data-[state=unchecked]:bg-primary"
      />

      <div className={`flex items-center space-x-2 transition-colors ${mode === "simulated" ? "text-secondary" : "text-muted-foreground"}`}>
        <Label htmlFor="mode-toggle" className="text-sm font-medium cursor-pointer">
          Simulated
        </Label>
        <Cpu className="h-4 w-4" />
      </div>

      <Badge
        variant={mode === "real" ? "default" : "secondary"}
        className={`${
          mode === "real"
            ? "bg-primary/20 text-primary border-primary/50"
            : "bg-secondary/20 text-secondary border-secondary/50"
        }`}
      >
        {mode === "real" ? "🔗 Real System" : "🧠 Simulated"}
      </Badge>
    </div>
  );
}
