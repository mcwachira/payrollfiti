'use client';
import React, { useState, useRef } from 'react';
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

interface EmployeeDocumentsProps {
  employeeId: string;
}

// type EmployeeDocument = Tables<'employee_documents'>;

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

const EmployeeDocuments: React.FC<EmployeeDocumentsProps> = ({
  employeeId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('');
  const [documentName, setDocumentName] = useState('');

  const documents = [
    {
      id: '8a1f2b33-2fbc-4a7c-8f7d-9a9f91a63a01',
      employee_id: '11111111-1111-1111-1111-111111111111',
      document_type: 'ID Proof',
      document_name: 'Passport.pdf',
      file_url: 'https://example.com/docs/passport.pdf',
      uploaded_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      uploaded_at: '2024-07-01T10:00:00Z',
    },
    {
      id: '3c5f3d88-a4b2-4d75-b4c6-487bdf51beed',
      employee_id: '22222222-2222-2222-2222-222222222222',
      document_type: 'Contract',
      document_name: 'EmploymentContract.pdf',
      file_url: 'https://example.com/docs/contract.pdf',
      uploaded_by: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      uploaded_at: '2024-07-02T14:15:00Z',
    },
    {
      id: '5fd2784f-f2a6-4e70-a829-1e6c1b6eb3a1',
      employee_id: '11111111-1111-1111-1111-111111111111',
      document_type: 'Certification',
      document_name: 'ReactCourseCert.pdf',
      file_url: 'https://example.com/docs/react-cert.pdf',
      uploaded_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      uploaded_at: '2024-07-03T09:30:00Z',
    },
    {
      id: '73287c99-31e2-4f25-8f90-7b672f4fd0b7',
      employee_id: '33333333-3333-3333-3333-333333333333',
      document_type: 'Performance Review',
      document_name: 'Q2Review.pdf',
      file_url: 'https://example.com/docs/q2-review.pdf',
      uploaded_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      uploaded_at: '2024-07-05T12:45:00Z',
    },
    {
      id: '9be21f06-66d4-42e2-9ec7-755e17c8fc0c',
      employee_id: '44444444-4444-4444-4444-444444444444',
      document_type: 'ID Proof',
      document_name: 'DriverLicense.pdf',
      file_url: 'https://example.com/docs/license.pdf',
      uploaded_by: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      uploaded_at: '2024-07-06T16:20:00Z',
    },
  ];

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // if (!file || !selectedDocType || !documentName.trim()) {
    //   toast({
    //     title: 'Missing Information',
    //     description: 'Please select document type, enter document name, and choose a file.',
    //     variant: 'destructive',
    //   });
    //   return;
    // }

    // setUploading(true);
    // try {
    // Upload file to Supabase Storage
    //   const fileExt = file.name.split('.').pop();
    //   const fileName = `${employeeId}/${selectedDocType}_${Date.now()}.${fileExt}`;

    //   const { data: uploadData, error: uploadError } = await supabase.storage
    //     .from('employee-documents')
    //     .upload(fileName, file);

    //   if (uploadError) throw uploadError;

    //   // Get public URL
    //   const { data: { publicUrl } } = supabase.storage
    //     .from('employee-documents')
    //     .getPublicUrl(fileName);

    //   // Save document record
    //   const { error: dbError } = await supabase
    //     .from('employee_documents')
    //     .insert([{
    //       employee_id: employeeId,
    //       document_type: selectedDocType,
    //       document_name: documentName,
    //       file_url: publicUrl,
    //     }]);

    //   if (dbError) throw dbError;

    //   toast({ title: 'Document uploaded successfully' });
    //   queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });

    //   // Reset form
    //   setSelectedDocType('');
    //   setDocumentName('');
    //   if (fileInputRef.current) fileInputRef.current.value = '';

    // } catch (error: any) {
    //   toast({
    //     title: 'Upload Failed',
    //     description: error.message,
    //     variant: 'destructive',
    //   });
    // } finally {
    //   setUploading(false);
    // }
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    // try {
    //   // Extract file path from URL
    //   const urlParts = fileUrl.split('/');
    //   const filePath = urlParts.slice(-2).join('/'); // Get last two parts (employeeId/filename)

    //   // Delete from storage
    //   await supabase.storage
    //     .from('employee-documents')
    //     .remove([filePath]);

    //   // Delete from database
    //   const { error } = await supabase
    //     .from('employee_documents')
    //     .delete()
    //     .eq('id', documentId);

    //   if (error) throw error;

    //   toast({ title: 'Document deleted successfully' });
    //   queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });

    // } catch (error: any) {
    //   toast({
    //     title: 'Delete Failed',
    //     description: error.message,
    //     variant: 'destructive',
    //   });
    // }
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find((dt) => dt.value === type)?.label || type;
  };

  //   if (isLoading) {
  //     return <div className="flex justify-center p-4">Loading documents...</div>;
  //   }

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
                <SelectTrigger>
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
              <Label htmlFor="docName">Document Name</Label>
              <Input
                id="docName"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="file">Choose File</Label>
            <Input
              id="file"
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={uploading}
            />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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
            Documents ({documents?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents && documents.length > 0 ? (
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
                      {doc.document_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDocumentTypeLabel(doc.document_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(doc.uploaded_at || '').toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = doc.file_url;
                              link.download = doc.document_name;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleDeleteDocument(doc.id, doc.file_url)
                            }
                            className="text-red-600"
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
