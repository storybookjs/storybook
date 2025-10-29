import {on} from '@ember/modifier';

<template>
  <button {{on "click" @onClick}}>{{@label}}</button>
</template>
