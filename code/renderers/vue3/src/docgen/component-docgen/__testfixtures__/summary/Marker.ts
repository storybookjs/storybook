import { defineComponent } from 'vue';

/** What a marker takes. */
export interface Marker {
  label: string;
}

/** A marker that shares its name with an interface. */
export const Marker = defineComponent({
  props: { label: String },
});
