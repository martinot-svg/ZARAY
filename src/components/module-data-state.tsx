/** Localized, non-blocking data status: no fullscreen skeletons or spinners. */
export default function ModuleDataState({label='Synchronisation des données…'}:{label?:string}){
 return <div className="zaray-data-pending" role="status" aria-live="polite">
  <span>{label}</span>
 </div>;
}
