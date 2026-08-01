'use client';
import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  MoreHorizontal,
  Eye,
} from 'lucide-react';
import {
  downloadEmployeeDocument,
  listEmployeeDocuments,
  removeEmployeeDocument,
  uploadEmployeeDocument,
  viewEmployeeDocument,
  type EmployeeDocument,
} from '@/lib/documents-api';
import { ApiError } from '@/lib/api-client';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

interface EmployeeDocumentsProps {
  employeeId: string;
}

const DOCUMENT_TYPES = [
  { value: 'id_copy', label: 'ID Copy' },
  { value: 'contract', label: 'Employment Contract' },
  { value: 'certificate', label: 'Academic Certificate' },
  { value: 'bank_details', label: 'Bank Details' },
  { value: 'tax_certificate', label: 'Tax Certificate' },
  { value: 'medical_report', label: 'Medical Report' },
  { value: 'reference_letter', label: 'Reference Letter' },
  { value: 'other', label: 'Other' },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const EmployeeDocuments: React.FC<EmployeeDocumentsProps> = ({
  employeeId,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState('');

  const documentsQuery = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () => listEmployeeDocuments(employeeId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadEmployeeDocument(employeeId, file, selectedDocType),
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({
        queryKey: ['employee-documents', employeeId],
      });
      setSelectedDocType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Failed to upload document'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeEmployeeDocument,
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({
        queryKey: ['employee-documents', employeeId],
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Failed to delete document'));
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedDocType) {
      toast.error('Select a document type before choosing a file');
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleView = async (doc: EmployeeDocument) => {
    try {
      await viewEmployeeDocument(doc.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to open document'));
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      await downloadEmployeeDocument(doc.id, doc.fileName);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to download document'));
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    deleteMutation.mutate(documentId);
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find((dt) => dt.value === type)?.label || type;
  };

  const documents = documentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
          <CardDescription>
            Upload employee documents such as contracts, certificates, and IDs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="docType">Document Type</Label>
              <Select
                value={selectedDocType}
                onValueChange={setSelectedDocType}
              >
                <SelectTrigger id="docType">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="file">Choose File</Label>
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploadMutation.isPending || !selectedDocType}
              />
            </div>
          </div>
          {uploadMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Uploading document...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentsQuery.isPending ? (
            <TableSkeleton rows={3} />
          ) : documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.fileName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDocumentTypeLabel(doc.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Actions for ${doc.fileName}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(doc)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default EmployeeDocuments;
