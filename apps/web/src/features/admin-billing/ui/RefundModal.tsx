import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useState } from "react";

export type RefundTarget = {
  kind: "payment" | "invoice";
  id: string;
  idempotencyKey: string;
  label: string;
  currency: string;
  refundableAmount: number;
};

type RefundModalProps = {
  opened: boolean;
  target: RefundTarget | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (amount: number | undefined) => void;
};

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function RefundModal({
  opened,
  target,
  loading,
  onClose,
  onConfirm,
}: RefundModalProps) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!target) return;

    if (mode === "full") {
      onConfirm(undefined);
      return;
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }

    const amountInMinorUnits = Math.round(amount * 100);

    if (amountInMinorUnits > target.refundableAmount) {
      setError("Refund amount exceeds the available amount.");
      return;
    }

    setError(null);
    onConfirm(amountInMinorUnits);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create refund"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      {target && (
        <Stack gap="md">
          <div>
            <Text fw={600}>{target.label}</Text>
            <Text size="sm" c="dimmed">
              Available:{" "}
              {formatAmount(target.refundableAmount, target.currency)}
            </Text>
          </div>

          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(value) => {
              setMode(value as "full" | "partial");
              setError(null);
            }}
            data={[
              { label: "Full remaining amount", value: "full" },
              { label: "Partial amount", value: "partial" },
            ]}
          />

          {mode === "partial" && (
            <NumberInput
              label="Refund amount"
              value={amount}
              onChange={(value) =>
                setAmount(typeof value === "bigint" ? Number(value) : value)
              }
              min={0.01}
              max={target.refundableAmount / 100}
              decimalScale={2}
              fixedDecimalScale
              error={error}
              prefix={target.currency.toUpperCase() + " "}
            />
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button color="red" onClick={submit} loading={loading}>
              Confirm refund
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
