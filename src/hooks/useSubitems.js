import { useState, useEffect, useCallback } from 'react';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

export const useSubitems = (leadId) => {
  const [subitems, setSubitems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubitems = useCallback(async () => {
    if (!leadId) {
      setSubitems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // We still READ msrpCa and totalPrice (reading mirror/lookup is fine)
      const lead = await leadsBoard.item(leadId)
        .withSubItems(['column20ProductCatalog', 'qty', 'msrpCa', 'totalPrice', 'includeexclude'])
        .execute();

      setSubitems(lead.subitems || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch subitems:', err);
      setError('Failed to load quote items');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchSubitems();
  }, [fetchSubitems]);

  // Signature simplified: we only need productId, productName, qty
  const createSubitem = async (productId, productName, qty = 1) => {
    try {
      const subitem = await leadsBoard.item(leadId).subitem().create({
        name: productName,
        column20ProductCatalog: { linkedItems: [{ id: productId }] },
        qty: qty,
        includeexclude: 'Include'
        // NOTE: NO msrpCa, NO totalPrice -> Monday fills these
      }).execute();

      // Wait for lookup to resolve, then refetch
      setTimeout(() => fetchSubitems(), 1500);

      return subitem;
    } catch (err) {
      console.error('Failed to create subitem:', err);
      throw new Error('Failed to add product');
    }
  };

  // Only write qty and includeexclude. Never msrpCa or totalPrice.
  const updateSubitem = async (subitemId, updates) => {
    try {
      // Strip any read-only fields that might have been passed in
      const safeUpdates = { ...updates };
      delete safeUpdates.msrpCa;
      delete safeUpdates.totalPrice;
      delete safeUpdates.unitPrice;

      await leadsBoard.item(leadId).subitem(subitemId).update(safeUpdates).execute();
      await fetchSubitems();
    } catch (err) {
      console.error('Failed to update subitem:', err);
      throw new Error('Failed to update item');
    }
  };

  const deleteSubitem = async (subitemId) => {
    try {
      await leadsBoard.item(subitemId).archive().execute();
      await fetchSubitems();
    } catch (err) {
      console.error('Failed to delete subitem:', err);
      throw new Error('Failed to remove item');
    }
  };

  return { subitems, loading, error, refetch: fetchSubitems, createSubitem, updateSubitem, deleteSubitem };
};
