import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets';
import type { NearbyWidgetProps } from '../widgets/widgets.model';
import type { ExpoWidget } from '../widgets/widgets.ports';

/**
 * The "Tar de Amex?" widget: home screen (small, medium) and lock screen. It runs in the widget
 * extension, not in the app: everything it uses is inside the function, and it only reads the
 * props that `SnapshotNearbyWidgetService` writes.
 */
function NearbyWidget(props: NearbyWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  const here = props.here;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const background = containerBackground({ type: 'hierarchical', style: 'quinary' }, 'widget');
  const link = here === null ? [] : [widgetURL(here.url)];

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={link}>
        {here === null ? 'Tar de Amex?' : `${here.name}: ${here.answer}`}
      </Text>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[...link, background]}>
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          {here === null ? 'Tar de Amex?' : here.name}
        </Text>
        <HStack spacing={4}>
          {here === null ? null : <Image systemName={here.symbol as 'questionmark.circle'} />}
          <Text>{here === null ? 'Ingen steder rett her' : here.answer}</Text>
        </HStack>
      </VStack>
    );
  }

  const title = (text: string) => (
    <Text modifiers={[font({ weight: 'semibold', size: 12 }), secondary]}>{text}</Text>
  );
  const updated = <Text modifiers={[font({ size: 11 }), secondary]}>{props.updated}</Text>;

  // Before the app has written anything (or nothing is known nearby): one plain line.
  if (here === null && props.accepted.length === 0) {
    return (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[frame({ maxWidth: 10_000, alignment: 'leading' }), background]}
      >
        {title('TAR DE AMEX?')}
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(3)]}>
          {props.updated === ''
            ? 'Åpne appen for å se steder i nærheten'
            : 'Ingen kjente steder i nærheten ennå'}
        </Text>
        <Spacer />
        {updated}
      </VStack>
    );
  }

  const herePanel =
    here === null ? null : (
      <VStack alignment="leading" spacing={6}>
        {title('DU ER HER')}
        <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(2)]}>{here.name}</Text>
        <HStack spacing={6}>
          <Image systemName={here.symbol as 'questionmark.circle'} size={22} color={here.color} />
          <Text modifiers={[font({ weight: 'bold', size: 20 }), lineLimit(1)]}>{here.answer}</Text>
        </HStack>
        <Spacer />
        {updated}
      </VStack>
    );

  const acceptedList = (limit: number) => (
    <VStack alignment="leading" spacing={6}>
      {title('I NÆRHETEN MED AMEX')}
      {props.accepted.slice(0, limit).map((place) => (
        <Link key={place.url} destination={place.url}>
          <HStack spacing={6}>
            <Image systemName="checkmark.circle.fill" size={14} color="#1E6B34" />
            <Text modifiers={[font({ size: 14 }), lineLimit(1)]}>{place.name}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12 }), secondary]}>{place.distance}</Text>
          </HStack>
        </Link>
      ))}
      <Spacer />
      {herePanel === null ? updated : null}
    </VStack>
  );

  const fill = frame({ maxWidth: 10_000, alignment: 'leading' });

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={[...link, fill, background]}>
        {herePanel ?? acceptedList(2)}
      </VStack>
    );
  }

  return (
    <HStack alignment="top" spacing={16} modifiers={[...link, fill, background]}>
      {herePanel}
      {props.accepted.length === 0 ? null : acceptedList(3)}
    </HStack>
  );
}

/**
 * The iOS widget; `nearby-widget.tsx` is the stand-in for other platforms. A build without the
 * widget extension (an older development build) gets no widget instead of a crash.
 */
function create(): ExpoWidget<NearbyWidgetProps> | null {
  try {
    return createWidget<NearbyWidgetProps>('NearbyWidget', NearbyWidget, {
      here: null,
      accepted: [],
      updated: '',
    });
  } catch {
    return null;
  }
}

export const nearbyWidget: ExpoWidget<NearbyWidgetProps> | null = create();
