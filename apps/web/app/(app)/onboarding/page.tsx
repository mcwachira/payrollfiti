'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Plus, Trash2, Upload, Users } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';\
import { getMyTenant, createCompany, type Tenant } from '@/lib/tenants-api';
import {
  listCompanies,
  bulkCreateEmployees,
  addSalaryStructure,
  type Company,
  type BulkCreateEmployeeResult,
} from '@/lib/employees-api';
import { calculatePayroll } from '@/lib/payroll-calculator-api';
import { listPlans, subscribe, type Plan } from '@/lib/billing-api';
import { getCountryName } from '@/lib/countries';
import { ApiError } from '@/lib/api-client';