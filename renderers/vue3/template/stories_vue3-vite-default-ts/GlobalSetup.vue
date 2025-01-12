<template>
  <global-button v-bind="$attrs"> </global-button>
  <h2> Hi message: {{ $greetingMessage('hi') }}</h2>
  <h3> Hello message: {{ $greetingMessage('hello') }}</h3>
  <h4> Welcome message: {{ $greetingMessage('welcome') }}</h4>
</template>
