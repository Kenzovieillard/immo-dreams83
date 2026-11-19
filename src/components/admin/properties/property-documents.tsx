"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialPanel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  documentKindLabels,
  documentKinds,
  propertyDocumentLimit,
  propertyDocumentUrl,
  type PropertyDocument,
  type PropertyDocumentFolder,
} from "@/lib/property-workspace";
import {
  PropertyField,
  propertyRequest,
  uploadPropertyDocument,
} from "./property-wizard";

export function PropertyDocuments({
  propertyId,
  canWrite,
}: {
  propertyId: string;
  canWrite: boolean;
}) {
  const [documents, setDocuments] = useState<PropertyDocument[] | null>(null);
  const [folders, setFolders] = useState<PropertyDocumentFolder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{ file: File; id: string } | null>(null);
  const [kind, setKind] = useState<PropertyDocument["kind"]>("other");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await propertyRequest<{
          documents: PropertyDocument[];
          folders: PropertyDocumentFolder[];
        }>(propertyDocumentUrl(propertyId), { signal });
        if (!signal?.aborted) {
          setDocuments(data.documents);
          setFolders(data.folders);
          setError("");
        }
      } catch (error) {
        if (!signal?.aborted)
          setError(
            error instanceof Error ? error.message : "Lecture impossible.",
          );
      }
    },
    [propertyId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await action();
      setFeedback(message);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "L’opération a échoué.",
      );
    } finally {
      setBusy(false);
    }
  }

  function renderDocument(doc: PropertyDocument) {
    return (
      <div
        key={doc.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dfddd4] p-3 text-sm"
      >
        <a
          href={propertyDocumentUrl(propertyId, doc.id)}
          className="flex min-w-0 items-center gap-2 underline"
          aria-label={`Télécharger ${doc.fileName}`}
        >
          <FileText aria-hidden="true" className="size-4 shrink-0" />
          <span className="break-all">{doc.fileName}</span>
        </a>
        <span className="text-xs text-[#59645f]">
          {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
          {doc.sizeBytes
            ? ` · ${Math.max(1, Math.round(doc.sizeBytes / 1024))} Kio`
            : ""}
        </span>
        {canWrite ? (
          <button
            type="button"
            className={commercialSecondaryButton}
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Archiver le document « ${doc.fileName} » ?`))
                void run(
                  () =>
                    propertyRequest(propertyDocumentUrl(propertyId, doc.id), {
                      method: "PATCH",
                    }).then(() => undefined),
                  "Document archivé.",
                );
            }}
          >
            Archiver
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <CommercialPanel className="grid gap-4 p-5">
      <h3 className="font-semibold">Documents du bien</h3>
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-[#943f37]"
        >
          <span>{error}</span>
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Relire les documents
          </button>
        </div>
      ) : null}
      {feedback ? (
        <p role="status" className="text-sm text-[#274331]">
          {feedback}
        </p>
      ) : null}
      {canWrite && documents ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!folderName.trim()) return;
            void run(async () => {
              const result = await propertyRequest<{
                folder: PropertyDocumentFolder;
              }>(propertyDocumentUrl(propertyId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: folderName }),
              });
              setFolderName("");
              setFolderId(result.folder.id);
            }, "Dossier créé.");
          }}
        >
          <PropertyField label="Nom du nouveau dossier">
            <input
              className={fieldClass}
              value={folderName}
              maxLength={80}
              disabled={busy}
              onChange={(event) => setFolderName(event.target.value)}
            />
          </PropertyField>
          <button
            className={commercialSecondaryButton}
            type="submit"
            disabled={busy || !folderName.trim()}
          >
            Créer un dossier
          </button>
        </form>
      ) : null}
      {canWrite && documents ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!upload) return;
            void run(async () => {
              await uploadPropertyDocument(propertyId, {
                ...upload,
                kind,
                folderId: folderId || undefined,
              });
              setUpload(null);
            }, "Document associé au bien.");
          }}
        >
          <PropertyField label="Fichier privé (PDF ou image, 4 Mio maximum)">
            <input
              className={fieldClass}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file || file.size > propertyDocumentLimit) {
                  if (file) setError("Le fichier dépasse 4 Mio.");
                  return;
                }
                setUpload({ file, id: crypto.randomUUID() });
              }}
            />
          </PropertyField>
          <PropertyField label="Catégorie">
            <select
              className={fieldClass}
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as PropertyDocument["kind"])
              }
              disabled={busy}
            >
              {documentKinds.map((item) => (
                <option key={item} value={item}>
                  {documentKindLabels[item]}
                </option>
              ))}
            </select>
          </PropertyField>
          {folders.length ? (
            <PropertyField label="Ranger dans le dossier">
              <select
                className={fieldClass}
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={busy}
              >
                <option value="">Classement par catégorie</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </PropertyField>
          ) : null}
          <button
            className={commercialPrimaryButton}
            type="submit"
            disabled={busy || !upload}
          >
            Ajouter le document
          </button>
          {upload ? (
            <span className="w-full break-all text-sm">
              {upload.file.name} · en attente
            </span>
          ) : null}
        </form>
      ) : null}
      {!documents && !error ? (
        <p role="status" className="text-sm">
          Chargement des documents…
        </p>
      ) : null}
      {documents?.length === 0 && !folders.length ? (
        <BentoEmptyState
          title="Aucun document"
          description="Les pièces ajoutées à ce dossier restent privées."
        />
      ) : null}
      {documentKinds.map((category) => {
        const rows = documents?.filter(
          (doc) => doc.kind === category && !doc.folderId,
        );
        if (!rows?.length) return null;
        return (
          <section key={category} className="grid gap-2">
            <h4 className="text-sm font-semibold">
              {documentKindLabels[category]}
            </h4>
            {rows.map(renderDocument)}
          </section>
        );
      })}
      {folders.map((folder) => (
        <section key={folder.id} className="grid gap-2">
          <h4 className="text-sm font-semibold">{folder.name}</h4>
          {documents?.some((doc) => doc.folderId === folder.id) ? (
            documents
              .filter((doc) => doc.folderId === folder.id)
              .map(renderDocument)
          ) : (
            <p className="text-xs text-[#59645f]">Dossier vide.</p>
          )}
        </section>
      ))}
    </CommercialPanel>
  );
}
