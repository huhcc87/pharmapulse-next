"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Printer,
  MessageSquare,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  mechanism?: string;
  recommendation: string;
  source: "RULES" | "AI";
  confidence?: number;
}

interface CounselingPoint {
  drug: string;
  points: string[];
  source: "RULES" | "AI";
}

interface CounterCopilotPanelProps {
  cartItems: Array<{ productName: string; quantity: number }>;
  patientAge?: number;
  allergies?: string[];
  onAcknowledge?: (interactionId: number) => void;
  requireAcknowledgment?: boolean;
}

export default function CounterCopilotPanel({
  cartItems,
  patientAge,
  allergies,
  onAcknowledge,
  requireAcknowledgment = false,
}: CounterCopilotPanelProps) {
  const [interactions, setInteractions] = useState<InteractionResult[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [counselingPoints, setCounselingPoints] = useState<CounselingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (cartItems.length === 0) {
      setInteractions([]);
      setDuplicates([]);
      setCounselingPoints([]);
      return;
    }

    checkInteractions();
  }, [cartItems]);

  const checkInteractions = async () => {
    setIsLoading(true);
    try {
      const drugNames = cartItems.map((item) => item.productName);

      const response = await fetch("/api/copilot/check-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drugNames,
          patientAge,
          allergies,
          useAI: false, // Start with rules-only, can be toggled
        }),
      });

      const data = await response.json();

      if (data.interactions) {
        setInteractions(data.interactions);
        setRequiresAck(data.requiresAcknowledgment || false);
      }

      if (data.duplicates) {
        setDuplicates(data.duplicates);
      }

      if (data.counselingPoints) {
        setCounselingPoints(data.counselingPoints);
      }
    } catch (error) {
      console.error("Failed to check interactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "LOW":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "MEDIUM":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "LOW":
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  if (cartItems.length === 0) {
    return null;
  }

  const highSeverityInteractions = interactions.filter((i) => i.severity === "HIGH");
  const hasIssues = interactions.length > 0 || duplicates.length > 0;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-blue-50 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Counter Copilot</CardTitle>
          </div>
          {isLoading && (
            <Badge variant="outline" className="text-xs">
              Checking...
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">
          AI-powered interaction checking and patient counseling
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Disclaimer */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800">
              <strong>Suggestions — Pharmacist Review Required.</strong> This is advisory only.
              Always verify interactions and provide proper patient counseling.
            </p>
          </div>
        </div>

        {/* High Severity Interactions */}
        {highSeverityInteractions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              High Severity Interactions (Requires Acknowledgment)
            </h4>
            {highSeverityInteractions.map((interaction, idx) => {
              const isAcked = acknowledged.has(idx);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-2 ${getSeverityColor(interaction.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getSeverityIcon(interaction.severity)}
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {interaction.drug1} + {interaction.drug2}
                        </div>
                        <div className="text-xs mt-1">{interaction.description}</div>
                      </div>
                    </div>
                    {interaction.source === "AI" && (
                      <Badge variant="outline" className="text-xs">
                        AI
                      </Badge>
                    )}
                  </div>

                  {interaction.mechanism && (
                    <div className="text-xs mt-2 opacity-90">
                      <strong>Mechanism:</strong> {interaction.mechanism}
                    </div>
                  )}

                  <div className="text-xs mt-2 font-medium">
                    <strong>Recommendation:</strong> {interaction.recommendation}
                  </div>

                  {requireAcknowledgment && !isAcked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-xs"
                      onClick={() => {
                        setAcknowledged(new Set(acknowledged).add(idx));
                        onAcknowledge?.(idx);
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Acknowledge (Pharmacist)
                    </Button>
                  )}

                  {isAcked && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Acknowledged by pharmacist
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Medium/Low Severity Interactions */}
        {interactions.filter((i) => i.severity !== "HIGH").length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Other Interactions</h4>
            {interactions
              .filter((i) => i.severity !== "HIGH")
              .map((interaction, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded border ${getSeverityColor(interaction.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-semibold">
                        {interaction.drug1} + {interaction.drug2}
                      </div>
                      <div className="text-xs mt-1">{interaction.description}</div>
                    </div>
                    {interaction.source === "AI" && (
                      <Badge variant="outline" className="text-xs">
                        AI
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Duplicate Therapy */}
        {duplicates.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-orange-700">Duplicate Therapy Alert</h4>
            {duplicates.map((dup, idx) => (
              <div key={idx} className="p-2 rounded bg-orange-50 border border-orange-200">
                <div className="text-xs font-semibold">{dup.drug}</div>
                <div className="text-xs text-orange-700 mt-1">{dup.message}</div>
              </div>
            ))}
          </div>
        )}

        {/* Counseling Points */}
        {counselingPoints.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Patient Counseling Points
              </h4>
              <Button size="sm" variant="outline" className="text-xs">
                <Printer className="w-3 h-3 mr-1" />
                Print
              </Button>
            </div>

            {counselingPoints.map((counseling, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{counseling.drug}</div>
                  {counseling.source === "AI" && (
                    <Badge variant="outline" className="text-xs">
                      AI
                    </Badge>
                  )}
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {counseling.points.map((point, pIdx) => (
                    <li key={pIdx} className="text-gray-700">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* No Issues */}
        {!hasIssues && !isLoading && (
          <div className="p-4 text-center text-sm text-gray-600">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p>No drug interactions detected.</p>
            <p className="text-xs mt-1">Review counseling points above.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
