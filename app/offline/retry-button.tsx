"use client";

import { Button } from "@/components/ui/button";

export function RetryButton() {
  return <Button size="lg" onClick={() => location.reload()}>Tentar de novo</Button>;
}
