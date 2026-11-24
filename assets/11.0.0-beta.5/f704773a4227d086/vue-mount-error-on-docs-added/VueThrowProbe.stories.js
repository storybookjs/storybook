export default {
  title: 'Probe/VueThrow',
  tags: ['autodocs'],
}

export const Throws = {
  decorators: [
    () => {
      throw new Error('Story did something wrong')
    }
  ]
}
