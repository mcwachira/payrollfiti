'use client';
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Calendar, Clock, Users, Search } from 'lucide-react';
import { toast } from 'sonner';

const LeaveManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [reviewComments, setReviewComments] = useState('');

  const handleReview = (status: 'approved' | 'rejected') => {
    if (!selectedApplication) return;
    // reviewLeaveMutation.mutate({
    //   applicationId: selectedApplication.id,
    //   status,
    //   comments: reviewComments
    // });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Applications
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaveStats?.totalApplications || 0}
            </div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaveStats?.pendingApplications || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaveStats?.approvalRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Applications approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Leave Days
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaveStats?.totalLeaveDays || 0}
            </div>
            <p className="text-xs text-muted-foreground">Days approved</p>
          </CardContent>
        </Card>
      </div> */}

      {/* <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Applications</TabsTrigger>
          <TabsTrigger value="history">Leave History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Leave Applications</CardTitle>
                  <CardDescription>
                    Review and approve employee leave requests
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by employee name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingApplications?.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No pending leave applications
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApplications?.map((application) => (
                    <div
                      key={application.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <h4 className="font-medium">
                          {application.employees?.first_name}{' '}
                          {application.employees?.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {application.employees?.employee_number} •{' '}
                          {application.employees?.department}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">
                            {application.leave_types?.name}
                          </span>{' '}
                          •{application.days_requested} days
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            application.start_date,
                          ).toLocaleDateString()}{' '}
                          -{new Date(application.end_date).toLocaleDateString()}
                        </p>
                        {application.reason && (
                          <p className="text-xs text-muted-foreground">
                            Reason: {application.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(application.status)}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedApplication(application)
                              }
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Review Leave Application
                              </DialogTitle>
                              <DialogDescription>
                                Review and approve or reject this leave
                                application
                              </DialogDescription>
                            </DialogHeader>
                            {selectedApplication && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <strong>Employee:</strong>{' '}
                                    {selectedApplication.employees?.first_name}{' '}
                                    {selectedApplication.employees?.last_name}
                                  </div>
                                  <div>
                                    <strong>Department:</strong>{' '}
                                    {selectedApplication.employees?.department}
                                  </div>
                                  <div>
                                    <strong>Leave Type:</strong>{' '}
                                    {selectedApplication.leave_types?.name}
                                  </div>
                                  <div>
                                    <strong>Days Requested:</strong>{' '}
                                    {selectedApplication.days_requested}
                                  </div>
                                  <div className="col-span-2">
                                    <strong>Period:</strong>{' '}
                                    {new Date(
                                      selectedApplication.start_date,
                                    ).toLocaleDateString()}{' '}
                                    -{' '}
                                    {new Date(
                                      selectedApplication.end_date,
                                    ).toLocaleDateString()}
                                  </div>
                                  {selectedApplication.reason && (
                                    <div className="col-span-2">
                                      <strong>Reason:</strong>{' '}
                                      {selectedApplication.reason}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="text-sm font-medium">
                                    Review Comments
                                  </label>
                                  <Textarea
                                    placeholder="Add comments about your decision..."
                                    value={reviewComments}
                                    onChange={(e) =>
                                      setReviewComments(e.target.value)
                                    }
                                    className="mt-1"
                                  />
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleReview('rejected')}
                                    disabled={reviewLeaveMutation.isPending}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                  <Button
                                    onClick={() => handleReview('approved')}
                                    disabled={reviewLeaveMutation.isPending}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>
                All leave applications and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allApplications?.map((application) => (
                  <div
                    key={application.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <h4 className="font-medium">
                        {application.employees?.first_name}{' '}
                        {application.employees?.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {application.leave_types?.name} •{' '}
                        {application.days_requested} days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(application.start_date).toLocaleDateString()}{' '}
                        -{new Date(application.end_date).toLocaleDateString()}
                      </p>
                      {application.review_comments && (
                        <p className="text-xs text-muted-foreground">
                          Comments: {application.review_comments}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {getStatusBadge(application.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        Applied:{' '}
                        {new Date(application.applied_at).toLocaleDateString()}
                      </p>
                      {application.reviewed_at && (
                        <p className="text-xs text-muted-foreground">
                          Reviewed:{' '}
                          {new Date(
                            application.reviewed_at,
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}
    </div>
  );
};

export default LeaveManagementPage;
