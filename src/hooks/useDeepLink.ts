import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

export function useDeepLink() {
  const [params] = useSearchParams();

  useEffect(() => {
    const id = params.get('id');

    if (id) {
      const el = document.getElementById(`todo-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('ring-2', 'ring-blue-400');
      setTimeout(() => el?.classList.remove('ring-2', 'ring-blue-400'), 2000);
    }
  }, [params]);
}
