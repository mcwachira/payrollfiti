'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  listSalaryComponents,
  createSalaryComponent,
  deactivateSalaryComponent,
  type SalaryComponentType,
  type SalaryComponentCalcType,
} from '@/lib/salary-components-api';
import { ApiError } from '@/lib/api-client';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** "Transport Allowance" -> "TRANSPORT_ALLOWANCE" — matches the backend's required [A-Z0-9_]+ code format. */
function slugifyCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface NewComponentFormProps {
  onCreated: () => void;
}

function NewComponentForm({ onCreated }: NewComponentFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [type, setType] = useState<SalaryComponentType>('EARNING');
  const [calcType, setCalcType] = useState<SalaryComponentCalcType>('FIXED');
  const [amount, setAmount] = useState('');
  const [isTaxable, setIsTaxable] = useState(true);

  const createMutation = useMutation({
    mutationFn: () =>
      createSalaryComponent({
        name: name.trim(),
        code: codeTouched ? code.trim() : slugifyCode(name),
        type,
        calcType,
        isTaxable,
        ...(calcType === 'FIXED'
          ? { defaultAmount: Number(amount) || undefined }
          : { defaultRate: Number(amount) || undefined }),
      }),
    onSuccess: () => {
      toast.success('Pay component added');
      setOpen(false);
      setName('');
      setCode('');
      setCodeTouched(false);
      setAmount('');
      onCreated();
    },
    onError: (error) =>
      toast.error('Could not add the pay component', {
        description: errorMessage(
          error,
          'Please check the details and try again',
        ),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Pay Component
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Custom Pay Component</DialogTitle>
          <DialogDescription>
            On top of the statutory deductions your country requires
            automatically, add your own recurring earnings or deductions — e.g.
            a transport allowance or union dues — to attach to salary
            structures.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="component-name">Name</Label>
            <Input
              id="component-name"
              placeholder="e.g. Transport Allowance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="component-code">
              Code{' '}
              <span className="text-muted-foreground font-normal">
                (auto-generated, editable)
              </span>
            </Label>
            <Input
              id="component-code"
              value={codeTouched ? code : slugifyCode(name)}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SalaryComponentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EARNING">Earning</SelectItem>
                  <SelectItem value="DEDUCTION">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Calculation</Label>
              <Select
                value={calcType}
                onValueChange={(v) => setCalcType(v as SalaryComponentCalcType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed amount</SelectItem>
                  <SelectItem value="PERCENTAGE_OF_BASIC">
                    % of basic salary
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="component-amount">
              Default {calcType === 'FIXED' ? 'amount' : 'rate (%)'}{' '}
              <span className="text-muted-foreground font-normal">
                (optional — can be set per employee instead)
              </span>
            </Label>
            <Input
              id="component-amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border-2 border-border p-3">
            <div>
              <Label htmlFor="component-taxable">Taxable</Label>
              <p className="text-xs text-muted-foreground">
                Included in the PAYE taxable-income base
              </p>
            </div>
            <Switch
              id="component-taxable"
              checked={isTaxable}
              onCheckedChange={setIsTaxable}
            />
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Adding…' : 'Add Component'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SalaryComponentsSettings() {
  const queryClient = useQueryClient();
  const componentsQuery = useQuery({
    queryKey: ['salary-components'],
    queryFn: () => listSalaryComponents(true),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSalaryComponent,
    onSuccess: () => {
      toast.success('Pay component removed');
      queryClient.invalidateQueries({ queryKey: ['salary-components'] });
    },
    onError: (error) =>
      toast.error('Could not remove the pay component', {
        description: errorMessage(error, 'Please try again'),
      }),
  });

  const components = componentsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Custom Pay Components</CardTitle>
            <CardDescription>
              Statutory deductions (PAYE, NSSF/SHIF, pension, UIF…) apply
              automatically based on your country — these are additional,
              tenant-defined earnings and deductions you attach to salary
              structures yourself.
            </CardDescription>
          </div>
          <NewComponentForm
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: ['salary-components'] })
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {componentsQuery.isPending ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : components.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No custom pay components yet — add one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {components.map((component) => (
              <div
                key={component.id}
                className="flex items-center justify-between rounded-md border-2 border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{component.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {component.code}
                    </div>
                  </div>
                  <Badge
                    variant={
                      component.type === 'EARNING' ? 'default' : 'destructive'
                    }
                  >
                    {component.type === 'EARNING' ? 'Earning' : 'Deduction'}
                  </Badge>
                  <Badge variant="outline">
                    {component.calcType === 'FIXED'
                      ? component.defaultAmount != null
                        ? `Fixed: ${component.defaultAmount}`
                        : 'Fixed'
                      : component.defaultRate != null
                        ? `${component.defaultRate}% of basic`
                        : '% of basic'}
                  </Badge>
                  {!component.isTaxable && (
                    <Badge variant="outline">Non-taxable</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Remove ${component.name}`}
                  onClick={() => deactivateMutation.mutate(component.id)}
                  disabled={deactivateMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
