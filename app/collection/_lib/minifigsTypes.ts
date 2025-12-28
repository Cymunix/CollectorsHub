// app/collection/_lib/minifigsTypes.ts
export type MinifigSetLink = {
  userCollectionItemId: string;
  catalogItemId: string;
  setName: string;
  setNumber: string | null;
  itemType: string | null;
  copyQty: number;
  imageUrl: string | null;
};

export type MinifigCard = {
  minifigId: string;
  minifigNumber: string;
  name: string | null;
  imageUrl: string | null;
  includedQtyTotal: number;
  sets: Array<
    MinifigSetLink & {
      copiesCount: number;
      copiesQtyTotal: number;
    }
  >;
};
