<?php

namespace App\Http\Controllers\Api\V1\Documents;

use App\Domain\Documents\Services\DocumentService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Documents\UploadDocumentRequest;
use App\Http\Resources\EmployeeDocumentResource;
use App\Models\EmployeeDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function __construct(
        private readonly DocumentService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', EmployeeDocument::class);

        $query = EmployeeDocument::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        if ($request->filled('document_type_id')) {
            $query->where('document_type_id', $request->input('document_type_id'));
        }

        return EmployeeDocumentResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function store(UploadDocumentRequest $request): JsonResponse
    {
        $this->authorize('create', EmployeeDocument::class);

        $document = $this->service->upload(
            $request->input('employee_id'),
            $request->input('document_type_id'),
            $request->file('document'),
            $request->user(),
            $request->input('metadata', [])
        );

        return (new EmployeeDocumentResource($document))->response()->setStatusCode(201);
    }

    public function show(EmployeeDocument $document): JsonResponse
    {
        $this->authorize('view', $document);

        return new EmployeeDocumentResource($document);
    }

    public function verify(Request $request, EmployeeDocument $document): JsonResponse
    {
        $this->authorize('update', $document);

        $this->service->verify($document, $request->user(), $request->input('status', 'approved'));

        return new EmployeeDocumentResource($document->fresh());
    }
}
