export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-center">
      <div>
        <h1 className="mb-2 font-display text-2xl text-red-deep">Compte en attente</h1>
        <p className="text-text-dim">
          Votre compte n'est pas encore affecté à un poste. Les ressources humaines vous
          placeront prochainement.
        </p>
      </div>
    </div>
  );
}
