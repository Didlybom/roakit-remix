import DoneIcon from '@mui/icons-material/Done';
import { Button, TextField } from '@mui/material';
import grey from '@mui/material/colors/grey';
import { useNavigation, useSubmit } from '@remix-run/react';
import { useState } from 'react';
import { bannedRecordSchema } from '../../schemas/schemas';
import { postJsonOptions } from '../../utils/httpUtils';
import { areRecordsEqual } from '../../utils/mapUtils';
import { sortAndFormatRecord } from '../../utils/stringUtils';

export default function BannedItems({
  storedBannedItems,
  title,
  storageKey,
  feedId,
  feedType,
}: {
  storedBannedItems: Record<string, boolean> | undefined;
  title: string;
  storageKey: 'bannedEvents' | 'bannedAccounts';
  feedId: string;
  feedType: string;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const [bannedItems, setBannedItems] = useState<Record<string, boolean>>(storedBannedItems ?? {});
  const [bannedItemsAsString, setBannedItemsAsString] = useState(sortAndFormatRecord(bannedItems));
  const [bannedItemsError, setBannedItemsError] = useState('');

  const parseBannedEvents = (value: string) => {
    setBannedItemsAsString(value);
    try {
      setBannedItems(bannedRecordSchema.parse(JSON.parse(value)));
      setBannedItemsError('');
    } catch (e) {
      setBannedItemsError('Invalid');
    }
  };

  if (navigation.state === 'loading') {
    return null;
  }
  return (
    <>
      <TextField
        label={title}
        value={bannedItemsAsString}
        error={!!bannedItemsError}
        helperText={bannedItemsError}
        onChange={e => parseBannedEvents(e.target.value)}
        disabled={navigation.state !== 'idle'}
        fullWidth
        multiline
        minRows={5}
        maxRows={15}
        size="small"
        inputProps={{
          style: {
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '.8rem',
            backgroundColor: grey[200],
            padding: '5px',
          },
        }}
      />
      {!bannedItemsError && !areRecordsEqual(bannedItems, storedBannedItems ?? {}) && (
        <Button
          variant="contained"
          startIcon={<DoneIcon />}
          sx={{ mt: 2 }}
          onClick={() =>
            submit(
              {
                feedId,
                type: feedType,
                [storageKey]: JSON.stringify(bannedItems),
              },
              postJsonOptions
            )
          }
        >
          Save Banned List
        </Button>
      )}
    </>
  );
}
